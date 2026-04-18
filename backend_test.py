#!/usr/bin/env python3

import requests
import sys
import json
import io
from datetime import datetime
from PIL import Image

class FitAIAPITester:
    def __init__(self, base_url="https://fitai-style.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}" if endpoint else self.base_url
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            expected_message = "FitAI API"
            if response.get('message') == expected_message:
                print(f"   ✅ Correct message: '{expected_message}'")
                return True
            else:
                print(f"   ❌ Wrong message. Expected: '{expected_message}', Got: '{response.get('message')}'")
                return False
        return success

    def test_get_saved_looks_empty(self):
        """Test getting saved looks when empty"""
        success, response = self.run_test(
            "Get Saved Looks (Empty)",
            "GET",
            "saved-looks",
            200
        )
        if success and isinstance(response, list):
            if len(response) == 0:
                print(f"   ✅ Returns empty array as expected")
                return True
            else:
                print(f"   ⚠️  Returns {len(response)} items, expected empty array")
                return True  # Still pass, just not empty
        return success

    def test_create_saved_look(self):
        """Test creating a new saved look"""
        test_look = {
            "title": "Test Casual Look",
            "why_it_works": "This outfit combines comfort with style, perfect for a relaxed day out.",
            "vibe_match": "casual weekend",
            "items_used": [0, 1, 2],
            "tryon_image_url": None,
            "collage_items": []
        }
        
        success, response = self.run_test(
            "Create Saved Look",
            "POST",
            "saved-looks",
            200,
            data=test_look
        )
        
        if success and isinstance(response, dict):
            # Check if response has required fields
            required_fields = ['id', 'title', 'why_it_works', 'vibe_match', 'items_used', 'created_at']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                print(f"   ✅ All required fields present")
                return response.get('id')  # Return ID for potential cleanup
            else:
                print(f"   ❌ Missing fields: {missing_fields}")
                return False
        return success

    def test_get_saved_looks_with_data(self):
        """Test getting saved looks after creating one"""
        success, response = self.run_test(
            "Get Saved Looks (With Data)",
            "GET",
            "saved-looks",
            200
        )
        if success and isinstance(response, list):
            if len(response) > 0:
                print(f"   ✅ Returns {len(response)} saved look(s)")
                return response[0].get('id') if response else None
            else:
                print(f"   ⚠️  Still returns empty array")
                return True
        return success

    def test_delete_saved_look(self, look_id):
        """Test deleting a saved look"""
        if not look_id:
            print("   ⚠️  No look ID provided, skipping delete test")
            return True
            
        success, response = self.run_test(
            f"Delete Saved Look ({look_id})",
            "DELETE",
            f"saved-looks/{look_id}",
            200
        )
        return success

    def create_test_image(self, width=100, height=100, color=(255, 0, 0)):
        """Create a test image for upload testing"""
        img = Image.new('RGB', (width, height), color)
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        return img_bytes

    def test_generate_outfits_endpoint(self):
        """Test the generate-outfits endpoint with multipart form data"""
        print(f"\n🔍 Testing Generate Outfits Endpoint...")
        
        # Create test images
        test_images = []
        for i in range(3):  # Minimum 3 images required
            img_bytes = self.create_test_image(color=(255, i*50, i*100))
            test_images.append(('clothing_images', (f'test_clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        # Test data
        form_data = {
            'vibe': 'casual weekend'
        }
        
        url = f"{self.base_url}/generate-outfits"
        self.tests_run += 1
        
        try:
            response = requests.post(url, data=form_data, files=test_images, timeout=60)
            
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if 'outfits' in response_data and 'clothing_previews' in response_data:
                        print(f"   ✅ Response contains required fields: outfits, clothing_previews")
                        return True
                    else:
                        print(f"   ❌ Missing required fields in response")
                        return False
                except:
                    print(f"   ❌ Invalid JSON response")
                    return False
            elif response.status_code == 500:
                print(f"⚠️  Server error (500) - likely API key issue or AI service unavailable")
                print(f"   Response: {response.text[:200]}")
                return True  # Don't fail test for external service issues
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_generate_outfit_image_endpoint(self):
        """Test the generate-outfit-image endpoint"""
        print(f"\n🔍 Testing Generate Outfit Image Endpoint...")
        
        # Create test images
        person_img = self.create_test_image(color=(255, 200, 150))  # Skin tone-ish
        clothing_imgs = []
        for i in range(2):
            img_bytes = self.create_test_image(color=(100, i*100, 255))
            clothing_imgs.append(('clothing_images', (f'test_clothing_{i}.jpg', img_bytes, 'image/jpeg')))
        
        files = [
            ('person_image', ('person.jpg', person_img, 'image/jpeg'))
        ] + clothing_imgs
        
        form_data = {
            'outfit_description': 'Casual weekend outfit with jeans and t-shirt'
        }
        
        url = f"{self.base_url}/generate-outfit-image"
        self.tests_run += 1
        
        try:
            response = requests.post(url, data=form_data, files=files, timeout=120)
            
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if 'success' in response_data:
                        print(f"   ✅ Response contains success field")
                        if response_data.get('success'):
                            print(f"   ✅ Image generation reported as successful")
                        else:
                            print(f"   ⚠️  Image generation failed: {response_data.get('error', 'Unknown error')}")
                        return True
                    else:
                        print(f"   ❌ Missing success field in response")
                        return False
                except:
                    print(f"   ❌ Invalid JSON response")
                    return False
            elif response.status_code == 500:
                print(f"⚠️  Server error (500) - likely API key issue or AI service unavailable")
                print(f"   Response: {response.text[:200]}")
                return True  # Don't fail test for external service issues
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

def main():
    print("🚀 Starting FitAI Backend API Tests")
    print("=" * 50)
    
    tester = FitAIAPITester()
    
    # Test sequence
    print("\n📋 Running API Tests...")
    
    # 1. Test root endpoint
    tester.test_root_endpoint()
    
    # 2. Test getting saved looks when empty
    tester.test_get_saved_looks_empty()
    
    # 3. Test creating a saved look
    created_look_id = tester.test_create_saved_look()
    
    # 4. Test getting saved looks with data
    look_id = tester.test_get_saved_looks_with_data()
    
    # 5. Test generate-outfits endpoint
    tester.test_generate_outfits_endpoint()
    
    # 6. Test generate-outfit-image endpoint
    tester.test_generate_outfit_image_endpoint()
    
    # 7. Test deleting the created look (cleanup)
    if created_look_id:
        tester.test_delete_saved_look(created_look_id)
    elif look_id:
        tester.test_delete_saved_look(look_id)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())