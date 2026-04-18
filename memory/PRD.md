# FitAI Product Requirements Document

## Version: 1.1
## Status: MVP Complete (Gemini Integration)
## Date: January 2026

---

## Overview
FitAI is an AI-powered personal styling platform that generates outfit recommendations from clothes users already own. Users upload a photo of themselves and 3-5 clothing items, describe their style vibe, and receive AI-generated outfit combinations with explanations. The platform can also generate AI images showing the user wearing the suggested outfits.

---

## User Personas

### Primary: Style-Aware but Time-Poor User
- Age: 18-35
- Cares about dressing well but lacks time/knowledge for constant outfit curation
- Owns liked individual items but struggles to combine them
- Wants intentional dressing without paying for a stylist

### Secondary: Capsule Wardrobe Builder
- Owns fewer, deliberate pieces
- Wants to maximize outfit combinations from a small wardrobe

---

## Core Requirements (V1 - MVP)

### Landing Page
- [x] Headline: "Wear what you own. Look like yourself."
- [x] Subheadline with value proposition
- [x] "Try it now" CTA button
- [x] Mock swipe card as hero visual
- [x] Navigation to Saved Looks

### Onboarding Flow (3 Steps)
- [x] Step 1: Self photo upload (full body recommended)
- [x] Step 2: Clothing upload grid (3-5 items)
- [x] Step 3: Vibe text input with quick suggestions
- [x] Progress indicator
- [x] "Style me" button activation when complete
- [x] Image compression before upload for faster processing

### AI Outfit Generation (Gemini)
- [x] Gemini 2.5 Flash integration via emergentintegrations
- [x] Multimodal image + text analysis
- [x] Returns 5 outfit combinations with:
  - Title
  - Items used (indices)
  - Why it works (explanation)
  - Vibe match

### AI Image Generation (Gemini Nano Banana)
- [x] Gemini 3.1 Flash Image Preview integration
- [x] Generates images of user wearing outfit
- [x] "Generate AI Image" button on swipe cards
- [x] Loading state during generation

### Swipe Interface
- [x] Tinder-style card stack (70vh on desktop)
- [x] Drag-to-swipe with framer-motion
- [x] Save (heart) and Dismiss (X) buttons
- [x] Keyboard arrow support
- [x] Outfit card with:
  - Generated image or collage fallback
  - Title and explanation
  - Item chips showing clothes used
- [x] Card counter indicator
- [x] "Tweak vibe" input for regeneration

### Saved Looks Page
- [x] Grid of saved outfit cards
- [x] Empty state with CTA
- [x] Delete functionality
- [x] Vibe match tags
- [x] Shows generated AI images when available

---

## What's Been Implemented

### Backend (FastAPI)
- `/api/` - Health check
- `/api/generate-outfits` - Gemini AI outfit generation (multimodal)
- `/api/generate-outfit-image` - Gemini Nano Banana image generation
- `/api/saved-looks` - CRUD for saved looks (MongoDB)
- Image compression with Pillow

### Frontend (React + Tailwind)
- Landing page with editorial design
- 3-step onboarding with image uploads
- Client-side image compression utility
- Swipe interface with framer-motion animations
- Generate AI Image button for outfit visualization
- Saved looks grid page
- Sonner toast notifications

### Design System
- Colors: #FAFAF8 (background), #1C1C1E (text), #7C9E7E (sage green), #C9908A (dusty rose)
- Fonts: Playfair Display (headings), Inter (body)
- Card shadows and rounded corners
- Mobile-responsive layout

---

## Technical Stack
- Frontend: React 19, Tailwind CSS, framer-motion
- Backend: FastAPI, Motor (MongoDB async)
- Database: MongoDB
- AI Text: Gemini 2.5 Flash (via emergentintegrations)
- AI Image: Gemini 3.1 Flash Image Preview / Nano Banana (via emergentintegrations)

---

## API Keys Configured
- GEMINI_API_KEY: User's own Gemini key
- EMERGENT_LLM_KEY: For Nano Banana image generation

---

## Next Action Items
1. Test with real clothing photos to validate Gemini outfit suggestions
2. Optimize Nano Banana image generation quality with better prompts
3. Add image caching to avoid regenerating same outfits
4. Consider adding outfit style tags for better organization
5. Premium tier for unlimited image generations
