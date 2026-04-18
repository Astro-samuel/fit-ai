# FitAI Product Requirements Document

## Version: 1.0
## Status: MVP Complete
## Date: January 2026

---

## Overview
FitAI is an AI-powered personal styling platform that generates outfit recommendations from clothes users already own. Users upload a photo of themselves and 3-5 clothing items, describe their style vibe, and receive AI-generated outfit combinations with explanations.

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

### AI Outfit Generation
- [x] Claude claude-sonnet-4-20250514 integration
- [x] Multimodal image + text analysis
- [x] Returns 5 outfit combinations with:
  - Title
  - Items used (indices)
  - Why it works (explanation)
  - Vibe match

### Swipe Interface
- [x] Tinder-style card stack (70vh on desktop)
- [x] Drag-to-swipe with framer-motion
- [x] Save (heart) and Dismiss (X) buttons
- [x] Keyboard arrow support
- [x] Outfit card with:
  - Image area (collage fallback)
  - Title and explanation
  - Item chips showing clothes used
- [x] Card counter indicator
- [x] "Tweak vibe" input for regeneration

### Saved Looks Page
- [x] Grid of saved outfit cards
- [x] Empty state with CTA
- [x] Delete functionality
- [x] Vibe match tags

### Virtual Try-On (Replicate IDM-VTON)
- [x] API integration implemented
- [x] Falls back to collage if API fails/slow

---

## What's Been Implemented

### Backend (FastAPI)
- `/api/` - Health check
- `/api/generate-outfits` - Claude AI outfit generation
- `/api/virtual-tryon` - Replicate IDM-VTON integration
- `/api/saved-looks` - CRUD for saved looks (MongoDB)

### Frontend (React + Tailwind)
- Landing page with editorial design
- 3-step onboarding with image uploads
- Swipe interface with framer-motion animations
- Saved looks grid page
- Sonner toast notifications

### Design System
- Colors: #FAFAF8 (background), #1C1C1E (text), #7C9E7E (sage green), #C9908A (dusty rose)
- Fonts: Playfair Display (headings), Inter (body)
- Card shadows and rounded corners
- Mobile-responsive layout

---

## Prioritized Backlog

### P0 - Must Have (Completed)
- [x] Landing page
- [x] Onboarding flow
- [x] AI outfit generation
- [x] Swipe interface
- [x] Saved looks

### P1 - Should Have (Next Phase)
- [ ] Virtual try-on image compositing (Replicate optimization)
- [ ] Style prompt refinement without re-upload
- [ ] Improved loading states with skeleton UI
- [ ] Image optimization/compression

### P2 - Nice to Have (Future)
- [ ] User accounts and persistent profiles
- [ ] Weather integration
- [ ] Live trend lookup
- [ ] Spotify/Apple Music vibe integration
- [ ] Shareable outfit cards
- [ ] Capsule Bridge analysis

---

## Technical Stack
- Frontend: React 19, Tailwind CSS, framer-motion
- Backend: FastAPI, Motor (MongoDB async)
- Database: MongoDB
- AI: Anthropic Claude claude-sonnet-4-20250514
- Virtual Try-On: Replicate IDM-VTON

---

## Next Action Items
1. Optimize virtual try-on latency and error handling
2. Add image compression before upload
3. Implement local storage caching for session persistence
4. Add more vibe suggestions based on common patterns
5. Consider premium tier for unlimited generations
