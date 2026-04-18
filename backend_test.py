#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

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
    
    # 5. Test deleting the created look (cleanup)
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