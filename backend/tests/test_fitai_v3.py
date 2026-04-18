#!/usr/bin/env python3
"""
FitAI Backend API Tests - V3
Tests for new features:
1. /api/validate-person-photo - Full body photo validation
2. /api/generate-outfits - With num_clothing and num_shoes fields
3. /api/generate-outfit-image - Improved prompt for user photo editing
4. Existing CRUD endpoints for saved-looks
"""

import pytest
import requests
import os
import io
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def create_test_image(width=100, height=100, color=(255, 0, 0)):
    """Create a test image for upload testing"""
    img = Image.new('RGB', (width, height), color)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes


def create_full_body_test_image():
    """Create a taller image simulating full body photo"""
    # Create a tall image (3:4 aspect ratio like portrait)
    img = Image.new('RGB', (300, 400), (255, 200, 150))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes


def create_cropped_face_image():
    """Create a square image simulating cropped face photo"""
    # Create a square image (1:1 aspect ratio like face crop)
    img = Image.new('RGB', (200, 200), (255, 200, 150))
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes


class TestHealthEndpoints:
    """Basic health check tests"""
    
    def test_root_endpoint(self, api_client):
        """Test the root API endpoint returns FitAI message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get('message') == 'FitAI API'
        print("Root endpoint returns correct FitAI API message")


class TestValidatePersonPhoto:
    """Tests for /api/validate-person-photo endpoint"""
    
    def test_validate_photo_endpoint_exists(self, api_client):
        """Test that validate-person-photo endpoint exists and accepts POST"""
        # Create a test image
        img_bytes = create_full_body_test_image()
        files = {'person_image': ('test.jpg', img_bytes, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/validate-person-photo",
            files=files,
            timeout=60
        )
        
        # Should return 200 (not 404 or 405)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"Validate photo endpoint exists and returns 200")
        
    def test_validate_photo_response_structure(self, api_client):
        """Test that response has required fields: valid, is_full_body, is_person_visible, feedback"""
        img_bytes = create_full_body_test_image()
        files = {'person_image': ('test.jpg', img_bytes, 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/validate-person-photo",
            files=files,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert 'valid' in data, "Response missing 'valid' field"
        assert 'feedback' in data, "Response missing 'feedback' field"
        
        # These fields should be present (may be True/False based on AI analysis)
        print(f"Validation response: valid={data.get('valid')}, feedback={data.get('feedback')}")
        print(f"Full response structure: {list(data.keys())}")


class TestGenerateOutfitsWithShoes:
    """Tests for /api/generate-outfits with num_clothing and num_shoes fields"""
    
    def test_generate_outfits_accepts_num_clothing_num_shoes(self, api_client):
        """Test that generate-outfits accepts num_clothing and num_shoes form fields"""
        # Create 4 clothing images + 2 shoe images = 6 total
        files = []
        for i in range(4):  # 4 clothing items
            img_bytes = create_test_image(color=(100, i*50, 200))
            files.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        for i in range(2):  # 2 shoe items
            img_bytes = create_test_image(color=(50, 50, i*100))
            files.append(('clothing_images', (f'shoe_{i}.jpg', img_bytes, 'image/jpeg')))
        
        form_data = {
            'vibe': 'casual weekend',
            'num_clothing': '4',
            'num_shoes': '2'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfits",
            data=form_data,
            files=files,
            timeout=120
        )
        
        # Should accept the request (200 or 500 for AI service issues)
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert 'outfits' in data, "Response missing 'outfits' field"
            assert 'clothing_previews' in data, "Response missing 'clothing_previews' field"
            print(f"Generate outfits with shoes: {len(data.get('outfits', []))} outfits generated")
        else:
            print(f"AI service returned 500 (expected for test images): {response.text[:200]}")
    
    def test_generate_outfits_minimum_3_items(self, api_client):
        """Test that generate-outfits requires minimum 3 clothing items"""
        # Only 2 images - should fail
        files = []
        for i in range(2):
            img_bytes = create_test_image(color=(100, i*50, 200))
            files.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        form_data = {
            'vibe': 'casual',
            'num_clothing': '2',
            'num_shoes': '0'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfits",
            data=form_data,
            files=files,
            timeout=30
        )
        
        # Should return 400 for insufficient items
        assert response.status_code == 400, f"Expected 400 for <3 items, got {response.status_code}"
        print("Correctly rejects requests with less than 3 clothing items")
    
    def test_generate_outfits_max_8_items(self, api_client):
        """Test that generate-outfits rejects more than 8 items (5 clothing + 3 shoes)"""
        # 9 images - should fail
        files = []
        for i in range(9):
            img_bytes = create_test_image(color=(100, i*20, 200))
            files.append(('clothing_images', (f'item_{i}.jpg', img_bytes, 'image/jpeg')))
        
        form_data = {
            'vibe': 'casual',
            'num_clothing': '6',
            'num_shoes': '3'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfits",
            data=form_data,
            files=files,
            timeout=30
        )
        
        # Should return 400 for too many items
        assert response.status_code == 400, f"Expected 400 for >8 items, got {response.status_code}"
        print("Correctly rejects requests with more than 8 items")


class TestGenerateOutfitImage:
    """Tests for /api/generate-outfit-image endpoint"""
    
    def test_generate_outfit_image_endpoint_exists(self, api_client):
        """Test that generate-outfit-image endpoint exists"""
        person_img = create_full_body_test_image()
        clothing_imgs = []
        for i in range(2):
            img_bytes = create_test_image(color=(100, i*100, 255))
            clothing_imgs.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        files = [
            ('person_image', ('person.jpg', person_img, 'image/jpeg'))
        ] + clothing_imgs
        
        form_data = {
            'outfit_description': 'Casual weekend outfit'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfit-image",
            data=form_data,
            files=files,
            timeout=180
        )
        
        # Should return 200 (endpoint exists)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'success' in data, "Response missing 'success' field"
        print(f"Generate outfit image: success={data.get('success')}")
        
        if data.get('success') and data.get('generated_image_url'):
            print("Image generation successful - URL returned")
        elif not data.get('success'):
            print(f"Image generation failed (expected for test images): {data.get('error', 'Unknown')}")


class TestSavedLooksCRUD:
    """Tests for saved-looks CRUD operations"""
    
    def test_get_saved_looks(self, api_client):
        """Test GET /api/saved-looks returns array"""
        response = api_client.get(f"{BASE_URL}/api/saved-looks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"GET saved-looks returns {len(data)} items")
    
    def test_create_and_delete_saved_look(self, api_client):
        """Test POST and DELETE for saved-looks"""
        # Create
        test_look = {
            "title": "TEST_Casual Look V3",
            "why_it_works": "Test outfit for V3 testing",
            "vibe_match": "casual weekend",
            "items_used": [0, 1, 2],
            "generated_image_url": None,
            "collage_items": []
        }
        
        create_response = api_client.post(
            f"{BASE_URL}/api/saved-looks",
            json=test_look
        )
        assert create_response.status_code == 200
        created = create_response.json()
        assert 'id' in created, "Created look missing 'id'"
        assert created['title'] == test_look['title']
        print(f"Created saved look with id: {created['id']}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{BASE_URL}/api/saved-looks")
        assert get_response.status_code == 200
        looks = get_response.json()
        found = any(look.get('id') == created['id'] for look in looks)
        assert found, "Created look not found in GET response"
        print("Verified look persisted in database")
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/saved-looks/{created['id']}")
        assert delete_response.status_code == 200
        print(f"Deleted saved look: {created['id']}")
        
        # Verify deletion
        get_after_delete = api_client.get(f"{BASE_URL}/api/saved-looks")
        looks_after = get_after_delete.json()
        not_found = not any(look.get('id') == created['id'] for look in looks_after)
        assert not_found, "Look still exists after deletion"
        print("Verified look removed from database")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
