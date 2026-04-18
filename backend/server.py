from fastapi import FastAPI, APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import json
import anthropic
import replicate
import httpx
import tempfile
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============ Models ============

class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class OutfitSuggestion(BaseModel):
    title: str
    items_used: List[int]
    why_it_works: str
    vibe_match: str

class OutfitGenerateRequest(BaseModel):
    vibe: str
    clothing_descriptions: List[str]

class OutfitGenerateResponse(BaseModel):
    outfits: List[OutfitSuggestion]

class SavedLook(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    why_it_works: str
    vibe_match: str
    items_used: List[int]
    tryon_image_url: Optional[str] = None
    collage_items: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaveLookRequest(BaseModel):
    title: str
    why_it_works: str
    vibe_match: str
    items_used: List[int]
    tryon_image_url: Optional[str] = None
    collage_items: List[str] = []


# ============ Helper Functions ============

def image_to_base64(image_bytes: bytes) -> str:
    """Convert image bytes to base64 string"""
    return base64.b64encode(image_bytes).decode('utf-8')

def get_mime_type(filename: str) -> str:
    """Get MIME type from filename"""
    ext = filename.lower().split('.')[-1] if '.' in filename else 'jpg'
    mime_map = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif'
    }
    return mime_map.get(ext, 'image/jpeg')


# ============ Routes ============

@api_router.get("/")
async def root():
    return {"message": "FitAI API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/generate-outfits")
async def generate_outfits(
    vibe: str = Form(...),
    clothing_images: List[UploadFile] = File(...)
):
    """
    Generate outfit suggestions using Claude AI based on uploaded clothing images and vibe.
    """
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    
    if len(clothing_images) < 3:
        raise HTTPException(status_code=400, detail="Please upload at least 3 clothing items")
    
    if len(clothing_images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 clothing items allowed")
    
    try:
        # Read all clothing images and convert to base64
        clothing_data = []
        for i, img in enumerate(clothing_images):
            content = await img.read()
            b64 = image_to_base64(content)
            mime_type = get_mime_type(img.filename or f"image_{i}.jpg")
            clothing_data.append({
                "index": i,
                "base64": b64,
                "mime_type": mime_type,
                "filename": img.filename
            })
        
        # Build the Claude message with images
        claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        
        # Build content array with all clothing images
        content = []
        for item in clothing_data:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": item["mime_type"],
                    "data": item["base64"]
                }
            })
        
        content.append({
            "type": "text",
            "text": f"""I've uploaded {len(clothing_data)} clothing items (indexed 0 to {len(clothing_data)-1}).
            
The user's vibe/style goal is: "{vibe}"

Please analyze these clothing items and create 5 outfit combinations using ONLY these exact items. Consider color theory, silhouette balance, fabric weight, and occasion appropriateness.

Return your response as a valid JSON array with exactly 5 objects. Each object must have:
- "title": A catchy outfit name (string)
- "items_used": Array of item indices (numbers from 0 to {len(clothing_data)-1}) used in this outfit
- "why_it_works": 2-3 sentences explaining why this combination works (string)
- "vibe_match": How this outfit matches the requested vibe (string)

IMPORTANT: Return ONLY the JSON array, no other text or explanation."""
        })
        
        system_prompt = """You are FitAI, an expert personal stylist. The user has uploaded photos of clothes they own. Your job is to create outfit combinations from exactly these items. You understand color theory, silhouette balance, fabric weight, and occasion dressing. You always explain why an outfit works so the user learns. You never suggest buying new clothes. Factor the user's described vibe and personality into every suggestion. Always return valid JSON."""
        
        logger.info(f"Calling Claude API with {len(clothing_data)} images and vibe: {vibe}")
        
        response = claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": content}
            ]
        )
        
        # Parse the response
        response_text = response.content[0].text
        logger.info(f"Claude response: {response_text[:500]}...")
        
        # Try to extract JSON from response
        try:
            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                outfits = json.loads(json_str)
            else:
                outfits = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        # Return clothing base64 data for collage fallback
        clothing_previews = [f"data:{item['mime_type']};base64,{item['base64']}" for item in clothing_data]
        
        return {
            "outfits": outfits,
            "clothing_previews": clothing_previews
        }
        
    except anthropic.APIError as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
    except Exception as e:
        logger.error(f"Error generating outfits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/virtual-tryon")
async def virtual_tryon(
    person_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    category: str = Form(default="upper_body"),
    garment_description: str = Form(default="clothing item")
):
    """
    Generate a virtual try-on image using Replicate's IDM-VTON model.
    """
    if not REPLICATE_API_TOKEN:
        raise HTTPException(status_code=500, detail="Replicate API token not configured")
    
    try:
        # Read images
        person_content = await person_image.read()
        garment_content = await garment_image.read()
        
        # Convert to data URLs
        person_mime = get_mime_type(person_image.filename or "person.jpg")
        garment_mime = get_mime_type(garment_image.filename or "garment.jpg")
        
        person_data_url = f"data:{person_mime};base64,{image_to_base64(person_content)}"
        garment_data_url = f"data:{garment_mime};base64,{image_to_base64(garment_content)}"
        
        logger.info(f"Calling Replicate IDM-VTON with category: {category}")
        
        # Initialize Replicate client
        replicate_client = replicate.Client(api_token=REPLICATE_API_TOKEN)
        
        # Run the model
        output = replicate_client.run(
            "cuuupid/idm-vton:c871bb9b046c1b1e8f53bfdbd8be3c8c3fd9eb8f78fbba83e75d74e3f5fc7740",
            input={
                "human_img": person_data_url,
                "garm_img": garment_data_url,
                "category": category,
                "garment_des": garment_description,
            }
        )
        
        logger.info(f"Replicate output: {output}")
        
        # Output is typically a URL to the generated image
        if isinstance(output, str):
            return {"tryon_image_url": output, "success": True}
        elif hasattr(output, '__iter__'):
            # If it's an iterator/list, get first item
            for item in output:
                return {"tryon_image_url": str(item), "success": True}
        
        raise HTTPException(status_code=500, detail="Unexpected output format from Replicate")
        
    except replicate.exceptions.ReplicateError as e:
        logger.error(f"Replicate API error: {e}")
        return {"tryon_image_url": None, "success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Error in virtual try-on: {e}")
        return {"tryon_image_url": None, "success": False, "error": str(e)}


@api_router.post("/saved-looks", response_model=SavedLook)
async def save_look(request: SaveLookRequest):
    """Save a liked outfit look"""
    look = SavedLook(
        title=request.title,
        why_it_works=request.why_it_works,
        vibe_match=request.vibe_match,
        items_used=request.items_used,
        tryon_image_url=request.tryon_image_url,
        collage_items=request.collage_items
    )
    
    doc = look.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.saved_looks.insert_one(doc)
    return look


@api_router.get("/saved-looks", response_model=List[SavedLook])
async def get_saved_looks():
    """Get all saved looks"""
    looks = await db.saved_looks.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for look in looks:
        if isinstance(look.get('created_at'), str):
            look['created_at'] = datetime.fromisoformat(look['created_at'])
    
    return looks


@api_router.delete("/saved-looks/{look_id}")
async def delete_saved_look(look_id: str):
    """Delete a saved look"""
    result = await db.saved_looks.delete_one({"id": look_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Look not found")
    return {"success": True}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
