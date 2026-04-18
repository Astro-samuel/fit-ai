import { useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LandingPage from "@/pages/LandingPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SwipePage from "@/pages/SwipePage";
import SavedLooksPage from "@/pages/SavedLooksPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

function App() {
  return (
    <div className="App min-h-screen bg-[#FAFAF8]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/swipe" element={<SwipePage />} />
          <Route path="/saved" element={<SavedLooksPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-center" />
    </div>
  );
}

export default App;
