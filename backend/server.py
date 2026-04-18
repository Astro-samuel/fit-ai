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
from io import BytesIO
from PIL import Image

# Load env first
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import emergent integrations after env is loaded
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

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

class SavedLook(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    why_it_works: str
    vibe_match: str
    items_used: List[int]
    generated_image_url: Optional[str] = None
    collage_items: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaveLookRequest(BaseModel):
    title: str
    why_it_works: str
    vibe_match: str
    items_used: List[int]
    generated_image_url: Optional[str] = None
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

def compress_image(image_bytes: bytes, max_size: int = 1024, quality: int = 85) -> bytes:
    """Compress and resize image for faster processing"""
    try:
        img = Image.open(BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        
        # Resize if larger than max_size
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save with compression
        output = BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Error compressing image: {e}")
        return image_bytes


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
        if isinstance(check.get('timestamp'), str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks


@api_router.post("/validate-person-photo")
async def validate_person_photo(
    person_image: UploadFile = File(...)
):
    """
    Validate that the uploaded photo shows a person's full body.
    Uses Gemini to analyze the image.
    """
    api_key = GEMINI_API_KEY or EMERGENT_LLM_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key configured")
    
    try:
        # Read and compress image
        content = await person_image.read()
        compressed = compress_image(content, max_size=800, quality=80)
        b64 = image_to_base64(compressed)
        
        # Initialize Gemini for validation
        session_id = f"validate-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an image analysis assistant that validates photos for a fashion styling app."
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        
        # Validation prompt
        prompt = """Analyze this photo and determine if it shows a person's FULL BODY (head to feet visible).

Return a JSON object with these fields:
- "is_full_body": boolean (true if full body from head to at least knees/feet is visible)
- "is_person_visible": boolean (true if a person is clearly visible in the photo)
- "feedback": string (brief feedback for the user, e.g. "Great full-body photo!" or "Please upload a photo showing your full body from head to feet")
- "body_parts_visible": array of strings (list which parts are visible: "head", "torso", "arms", "legs", "feet")

Return ONLY the JSON object, no other text."""

        user_message = UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64=b64)]
        )
        
        logger.info("Validating person photo with Gemini")
        response = await chat.send_message(user_message)
        
        # Parse response
        try:
            response_text = response.strip()
            if response_text.startswith("```"):
                lines = response_text.split('\n')
                response_text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
            
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                result = json.loads(json_str)
            else:
                result = json.loads(response_text)
                
            return {
                "valid": result.get("is_full_body", False) and result.get("is_person_visible", False),
                "is_full_body": result.get("is_full_body", False),
                "is_person_visible": result.get("is_person_visible", False),
                "feedback": result.get("feedback", "Unable to analyze photo"),
                "body_parts_visible": result.get("body_parts_visible", [])
            }
        except json.JSONDecodeError:
            logger.error(f"Failed to parse validation response: {response[:200]}")
            return {
                "valid": True,  # Default to valid if parsing fails
                "is_full_body": True,
                "is_person_visible": True,
                "feedback": "Photo accepted",
                "body_parts_visible": []
            }
            
    except Exception as e:
        logger.error(f"Error validating photo: {e}")
        return {
            "valid": True,  # Default to valid on error
            "feedback": "Photo validation skipped",
            "error": str(e)
        }


@api_router.post("/generate-outfits")
async def generate_outfits(
    vibe: str = Form(...),
    clothing_images: List[UploadFile] = File(...),
    num_clothing: int = Form(default=0),
    num_shoes: int = Form(default=0)
):
    """
    Generate outfit suggestions using Gemini AI based on uploaded clothing images and vibe.
    First N items are clothing, remaining are shoes (if num_shoes > 0).
    """
    api_key = GEMINI_API_KEY or EMERGENT_LLM_KEY
    if not api_key:
        raise HTTPException(status_code=500, detail="No API key configured")
    
    if len(clothing_images) < 3:
        raise HTTPException(status_code=400, detail="Please upload at least 3 clothing items")
    
    # Max 5 clothing + 3 shoes = 8 items
    if len(clothing_images) > 8:
        raise HTTPException(status_code=400, detail="Maximum 8 items allowed (5 clothing + 3 shoes)")
    
    # Determine split between clothing and shoes
    if num_clothing == 0 and num_shoes == 0:
        num_clothing = len(clothing_images)
        num_shoes = 0
    
    try:
        # Read and compress all clothing images
        clothing_data = []
        image_contents = []
        
        for i, img in enumerate(clothing_images):
            content = await img.read()
            # Compress image for faster processing
            compressed = compress_image(content, max_size=800, quality=80)
            b64 = image_to_base64(compressed)
            mime_type = get_mime_type(img.filename or f"image_{i}.jpg")
            
            clothing_data.append({
                "index": i,
                "base64": b64,
                "mime_type": mime_type,
                "filename": img.filename
            })
            
            # Create ImageContent for Gemini
            image_contents.append(ImageContent(image_base64=b64))
        
        # Initialize Gemini chat
        session_id = f"outfit-gen-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are FitAI, an expert personal stylist. You analyze clothing items and create outfit combinations. You understand color theory, silhouette balance, fabric weight, and occasion dressing. You always explain why an outfit works. You never suggest buying new clothes. Always return valid JSON."
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        
        # Build the prompt - distinguish clothing vs shoes
        items_description = ""
        if num_shoes > 0:
            clothing_indices = list(range(num_clothing))
            shoe_indices = list(range(num_clothing, num_clothing + num_shoes))
            items_description = f"""
Items breakdown:
- Clothing items (indices {clothing_indices[0]} to {clothing_indices[-1]}): {num_clothing} clothing pieces
- Shoe items (indices {shoe_indices[0]} to {shoe_indices[-1]}): {num_shoes} pairs of shoes

When creating outfits, try to include shoes when appropriate to complete the look."""
        
        prompt_text = f"""I've uploaded {len(clothing_data)} items total (indexed 0 to {len(clothing_data)-1}).
{items_description}

The user's vibe/style goal is: "{vibe}"

Please analyze these items and create 5 outfit combinations using ONLY these exact items. Consider color theory, silhouette balance, fabric weight, and occasion appropriateness.

Return your response as a valid JSON array with exactly 5 objects. Each object must have:
- "title": A catchy outfit name (string)
- "items_used": Array of item indices (numbers from 0 to {len(clothing_data)-1}) used in this outfit - include shoes when suitable
- "why_it_works": 2-3 sentences explaining why this combination works (string)
- "vibe_match": How this outfit matches the requested vibe (string)

IMPORTANT: Return ONLY the JSON array, no other text or explanation. Do not wrap in markdown code blocks."""

        # Create message with images
        user_message = UserMessage(
            text=prompt_text,
            file_contents=image_contents
        )
        
        logger.info(f"Calling Gemini API with {len(clothing_data)} images and vibe: {vibe}")
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        logger.info(f"Gemini response received: {response[:200]}...")
        
        # Parse the response
        try:
            # Clean response - remove markdown code blocks if present
            response_text = response.strip()
            if response_text.startswith("```"):
                # Remove markdown code blocks
                lines = response_text.split('\n')
                response_text = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])
            
            # Find JSON array in response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx != -1 and end_idx > start_idx:
                json_str = response_text[start_idx:end_idx]
                outfits = json.loads(json_str)
            else:
                outfits = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        # Return clothing base64 data for collage/display
        clothing_previews = [f"data:{item['mime_type']};base64,{item['base64']}" for item in clothing_data]
        
        return {
            "outfits": outfits,
            "clothing_previews": clothing_previews
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating outfits: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@api_router.post("/generate-outfit-image")
async def generate_outfit_image(
    person_image: UploadFile = File(...),
    outfit_description: str = Form(...),
    clothing_images: List[UploadFile] = File(...)
):
    """
    Generate an image of the person wearing the outfit using Gemini Nano Banana.
    """
    api_key = EMERGENT_LLM_KEY  # Nano Banana requires Emergent key
    if not api_key:
        raise HTTPException(status_code=500, detail="Emergent LLM key not configured")
    
    try:
        # Read and compress person image
        person_content = await person_image.read()
        person_compressed = compress_image(person_content, max_size=1024, quality=85)
        person_b64 = image_to_base64(person_compressed)
        
        # Read and compress clothing images
        clothing_b64_list = []
        for img in clothing_images:
            content = await img.read()
            compressed = compress_image(content, max_size=600, quality=80)
            clothing_b64_list.append(image_to_base64(compressed))
        
        # Initialize Gemini Nano Banana for image generation
        session_id = f"outfit-img-{uuid.uuid4()}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert fashion image generator. Create realistic, high-quality fashion photos."
        )
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        
        # Build image generation prompt - CRITICAL: Must explicitly use the person's photo
        prompt = f"""IMPORTANT: You must edit the FIRST image I'm providing (the person's photo) to show them wearing the outfit.

The first image is a photo of a real person - this is the EXACT person who should appear in the output image. Keep their face, body shape, skin tone, and overall appearance EXACTLY the same.

The other images show clothing items. Edit the person's photo to show them wearing these specific clothing items: {outfit_description}

Requirements:
1. The OUTPUT must show the SAME PERSON from the first image - same face, same body, same person
2. Replace their current clothes with the clothing items shown in the other images
3. Keep the person's pose natural and similar to their original photo
4. Maintain realistic lighting and proportions
5. The final image should look like a real photo of THIS SPECIFIC PERSON wearing the new outfit

Do NOT generate a different person. The person in the output MUST be the same person from the first reference image."""

        # Create message with all images
        image_contents = [ImageContent(image_base64=person_b64)]
        for b64 in clothing_b64_list:
            image_contents.append(ImageContent(image_base64=b64))
        
        user_message = UserMessage(
            text=prompt,
            file_contents=image_contents
        )
        
        logger.info("Calling Gemini Nano Banana for outfit image generation")
        
        # Generate image
        text_response, images = await chat.send_message_multimodal_response(user_message)
        
        if images and len(images) > 0:
            # Return the generated image as base64 data URL
            img_data = images[0]
            mime_type = img_data.get('mime_type', 'image/png')
            data = img_data.get('data', '')
            image_url = f"data:{mime_type};base64,{data}"
            
            logger.info("Successfully generated outfit image")
            return {
                "success": True,
                "generated_image_url": image_url,
                "text_response": text_response
            }
        else:
            logger.warning("No image generated by Nano Banana")
            return {
                "success": False,
                "generated_image_url": None,
                "error": "No image was generated"
            }
        
    except Exception as e:
        logger.error(f"Error generating outfit image: {e}")
        return {
            "success": False,
            "generated_image_url": None,
            "error": str(e)
        }


@api_router.post("/saved-looks", response_model=SavedLook)
async def save_look(request: SaveLookRequest):
    """Save a liked outfit look"""
    look = SavedLook(
        title=request.title,
        why_it_works=request.why_it_works,
        vibe_match=request.vibe_match,
        items_used=request.items_used,
        generated_image_url=request.generated_image_url,
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
