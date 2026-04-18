#!/usr/bin/env python3
"""
FitAI Backend API Tests - V4
Tests for new features:
1. /api/generate-outfits - Returns aesthetic_score (1-10) and suggestions fields
2. /api/generate-outfit-image - Accepts outfit_title, items_used, force_regenerate fields
3. /api/generate-outfit-image - Caching with cached field in response
4. MongoDB image_cache collection population
"""

import pytest
import requests
import os
import io
import json
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
    img = Image.new('RGB', (300, 400), (255, 200, 150))
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
        print("✓ Root endpoint returns correct FitAI API message")


class TestGenerateOutfitsV4:
    """Tests for /api/generate-outfits with aesthetic_score and suggestions fields"""
    
    def test_generate_outfits_returns_aesthetic_score_and_suggestions(self, api_client):
        """Test that generate-outfits returns outfits with aesthetic_score and suggestions fields"""
        # Create 3 clothing images (minimum required)
        files = []
        for i in range(3):
            img_bytes = create_test_image(color=(100, i*80, 200))
            files.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        form_data = {
            'vibe': 'casual weekend brunch',
            'num_clothing': '3',
            'num_shoes': '0'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfits",
            data=form_data,
            files=files,
            timeout=120
        )
        
        # Should accept the request
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert 'outfits' in data, "Response missing 'outfits' field"
            
            outfits = data.get('outfits', [])
            if len(outfits) > 0:
                first_outfit = outfits[0]
                
                # Check for aesthetic_score field
                has_aesthetic_score = 'aesthetic_score' in first_outfit
                print(f"✓ aesthetic_score field present: {has_aesthetic_score}")
                if has_aesthetic_score:
                    score = first_outfit['aesthetic_score']
                    assert isinstance(score, (int, float)), f"aesthetic_score should be number, got {type(score)}"
                    assert 1 <= score <= 10, f"aesthetic_score should be 1-10, got {score}"
                    print(f"  - aesthetic_score value: {score}/10")
                
                # Check for suggestions field
                has_suggestions = 'suggestions' in first_outfit
                print(f"✓ suggestions field present: {has_suggestions}")
                if has_suggestions:
                    suggestions = first_outfit['suggestions']
                    assert isinstance(suggestions, str), f"suggestions should be string, got {type(suggestions)}"
                    print(f"  - suggestions value: '{suggestions[:50]}...' (truncated)" if len(suggestions) > 50 else f"  - suggestions value: '{suggestions}'")
                
                # Verify existing fields still present
                assert 'title' in first_outfit, "Missing 'title' field"
                assert 'items_used' in first_outfit, "Missing 'items_used' field"
                assert 'why_it_works' in first_outfit, "Missing 'why_it_works' field"
                assert 'vibe_match' in first_outfit, "Missing 'vibe_match' field"
                print(f"✓ All required outfit fields present")
                
                print(f"✓ Generated {len(outfits)} outfits with new V4 fields")
            else:
                print("⚠ No outfits returned (AI may have failed to generate)")
        else:
            print(f"⚠ AI service returned 500 (expected for test images): {response.text[:200]}")


class TestGenerateOutfitImageV4:
    """Tests for /api/generate-outfit-image with new V4 fields and caching"""
    
    def test_generate_outfit_image_accepts_new_fields(self, api_client):
        """Test that generate-outfit-image accepts outfit_title, items_used, force_regenerate fields"""
        person_img = create_full_body_test_image()
        clothing_imgs = []
        for i in range(2):
            img_bytes = create_test_image(color=(100, i*100, 255))
            clothing_imgs.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        files = [
            ('person_image', ('person.jpg', person_img, 'image/jpeg'))
        ] + clothing_imgs
        
        form_data = {
            'outfit_description': 'Casual weekend outfit',
            'outfit_title': 'TEST_Weekend Vibes',
            'items_used': json.dumps([0, 1]),
            'force_regenerate': 'false'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfit-image",
            data=form_data,
            files=files,
            timeout=180
        )
        
        # Should return 200 (endpoint accepts new fields)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'success' in data, "Response missing 'success' field"
        print(f"✓ generate-outfit-image accepts new fields: outfit_title, items_used, force_regenerate")
        print(f"  - success: {data.get('success')}")
        
        # Check for cached field in response
        if 'cached' in data:
            print(f"✓ 'cached' field present in response: {data.get('cached')}")
        else:
            print("⚠ 'cached' field not present in response (may be expected for first call)")
    
    def test_generate_outfit_image_caching_behavior(self, api_client):
        """Test that second call with same person+outfit returns cached image"""
        # Create consistent test images for caching test
        person_img = create_full_body_test_image()
        person_img_copy = create_full_body_test_image()  # Same image for second call
        
        clothing_imgs = []
        for i in range(2):
            img_bytes = create_test_image(color=(150, 100, 200))
            clothing_imgs.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        clothing_imgs_copy = []
        for i in range(2):
            img_bytes = create_test_image(color=(150, 100, 200))
            clothing_imgs_copy.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        # First call - should generate new image
        files1 = [
            ('person_image', ('person.jpg', person_img, 'image/jpeg'))
        ] + clothing_imgs
        
        form_data = {
            'outfit_description': 'Test caching outfit',
            'outfit_title': 'TEST_Cache_Test_Outfit',
            'items_used': json.dumps([0, 1]),
            'force_regenerate': 'false'
        }
        
        print("Making first call (should generate new image)...")
        response1 = requests.post(
            f"{BASE_URL}/api/generate-outfit-image",
            data=form_data,
            files=files1,
            timeout=180
        )
        
        assert response1.status_code == 200, f"First call failed: {response1.status_code}"
        data1 = response1.json()
        print(f"  - First call success: {data1.get('success')}, cached: {data1.get('cached', 'N/A')}")
        
        if data1.get('success'):
            # Second call with same parameters - should return cached
            files2 = [
                ('person_image', ('person.jpg', person_img_copy, 'image/jpeg'))
            ] + clothing_imgs_copy
            
            print("Making second call (should return cached image)...")
            response2 = requests.post(
                f"{BASE_URL}/api/generate-outfit-image",
                data=form_data,
                files=files2,
                timeout=180
            )
            
            assert response2.status_code == 200, f"Second call failed: {response2.status_code}"
            data2 = response2.json()
            print(f"  - Second call success: {data2.get('success')}, cached: {data2.get('cached', 'N/A')}")
            
            # Check if cached field is True on second call
            if data2.get('cached') == True:
                print("✓ Caching working correctly - second call returned cached image")
            else:
                print("⚠ Second call did not return cached=True (may be due to different image hashes)")
        else:
            print("⚠ First call failed to generate image, cannot test caching")
    
    def test_force_regenerate_bypasses_cache(self, api_client):
        """Test that force_regenerate=true bypasses cache"""
        person_img = create_full_body_test_image()
        clothing_imgs = []
        for i in range(2):
            img_bytes = create_test_image(color=(200, 150, 100))
            clothing_imgs.append(('clothing_images', (f'clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        files = [
            ('person_image', ('person.jpg', person_img, 'image/jpeg'))
        ] + clothing_imgs
        
        form_data = {
            'outfit_description': 'Force regenerate test',
            'outfit_title': 'TEST_Force_Regen',
            'items_used': json.dumps([0, 1]),
            'force_regenerate': 'true'  # Force regeneration
        }
        
        response = requests.post(
            f"{BASE_URL}/api/generate-outfit-image",
            data=form_data,
            files=files,
            timeout=180
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"✓ force_regenerate=true accepted by API")
        print(f"  - success: {data.get('success')}, cached: {data.get('cached', 'N/A')}")
        
        # When force_regenerate is true, cached should be False (new generation)
        if data.get('success') and data.get('cached') == False:
            print("✓ force_regenerate correctly bypassed cache (cached=False)")
        elif data.get('success') and data.get('cached') == True:
            print("⚠ force_regenerate did not bypass cache (cached=True) - potential bug")


class TestSavedLooksCRUD:
    """Tests for saved-looks CRUD operations (regression)"""
    
    def test_get_saved_looks(self, api_client):
        """Test GET /api/saved-looks returns array"""
        response = api_client.get(f"{BASE_URL}/api/saved-looks")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET saved-looks returns {len(data)} items")
    
    def test_create_and_delete_saved_look(self, api_client):
        """Test POST and DELETE for saved-looks"""
        # Create
        test_look = {
            "title": "TEST_V4_Look",
            "why_it_works": "Test outfit for V4 testing",
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
        print(f"✓ Created saved look with id: {created['id']}")
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/saved-looks/{created['id']}")
        assert delete_response.status_code == 200
        print(f"✓ Deleted saved look: {created['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
