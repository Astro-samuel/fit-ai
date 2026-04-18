import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Heart, X, ArrowLeft, RefreshCw, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const SwipePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [outfits, setOutfits] = useState([]);
  const [clothingPreviews, setClothingPreviews] = useState([]);
  const [selfPhoto, setSelfPhoto] = useState(null);
  const [currentVibe, setCurrentVibe] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [tweakVibe, setTweakVibe] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [tryonImages, setTryonImages] = useState({});
  const [isLoadingTryon, setIsLoadingTryon] = useState({});

  // Initialize from navigation state
  useEffect(() => {
    if (location.state) {
      setOutfits(location.state.outfits || []);
      setClothingPreviews(location.state.clothingPreviews || []);
      setSelfPhoto(location.state.selfPhoto);
      setCurrentVibe(location.state.vibe || "");
    } else {
      navigate("/onboarding");
    }
  }, [location.state, navigate]);

  // Motion values for drag animation - must be at top level, not conditional
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  const saveIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);

  const currentOutfit = outfits[currentIndex];

  const handleSwipe = useCallback((dir) => {
    if (!currentOutfit) return;
    
    setDirection(dir);
    
    if (dir === 1) {
      // Liked - save the look
      saveLook(currentOutfit);
    }
    
    setTimeout(() => {
      if (currentIndex < outfits.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        toast.info("You've seen all outfits! Try tweaking your vibe for more.");
      }
      setDirection(0);
    }, 300);
  }, [currentOutfit, currentIndex, outfits.length]);

  const saveLook = async (outfit) => {
    try {
      const itemsUsed = outfit.items_used || [];
      const collageItems = itemsUsed.map(idx => clothingPreviews[idx]).filter(Boolean);
      
      await axios.post(`${API}/saved-looks`, {
        title: outfit.title,
        why_it_works: outfit.why_it_works,
        vibe_match: outfit.vibe_match,
        items_used: itemsUsed,
        tryon_image_url: tryonImages[currentIndex] || null,
        collage_items: collageItems
      });
      
      toast.success("Look saved!", {
        action: {
          label: "View Saved",
          onClick: () => navigate("/saved")
        }
      });
    } catch (error) {
      console.error("Error saving look:", error);
      toast.error("Failed to save look");
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowLeft") {
      handleSwipe(-1);
    } else if (e.key === "ArrowRight") {
      handleSwipe(1);
    }
  }, [handleSwipe]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleTweakVibe = async () => {
    if (!tweakVibe.trim()) return;
    
    setIsRegenerating(true);
    
    // Navigate back to onboarding with prefilled vibe
    navigate("/onboarding", {
      state: {
        prefillVibe: `${currentVibe}. ${tweakVibe}`,
        selfPhoto,
        clothingPreviews
      }
    });
  };

  const goToOutfit = (index) => {
    if (index >= 0 && index < outfits.length) {
      setDirection(index > currentIndex ? 1 : -1);
      setTimeout(() => {
        setCurrentIndex(index);
        setDirection(0);
      }, 150);
    }
  };

  if (!outfits.length) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#1C1C1E]/60 mb-4">No outfits to display</p>
          <Button
            onClick={() => navigate("/onboarding")}
            className="bg-[#7C9E7E] text-white rounded-full"
          >
            Start styling
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="w-full px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
        <button
          data-testid="back-btn"
          onClick={() => navigate("/onboarding")}
          className="flex items-center gap-2 text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">New Session</span>
        </button>
        
        <span className="font-serif text-xl tracking-tight text-[#1C1C1E]">FitAI</span>
        
        <button
          data-testid="saved-looks-btn"
          onClick={() => navigate("/saved")}
          className="flex items-center gap-2 text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors"
        >
          <Bookmark className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Saved</span>
        </button>
      </header>

      {/* Main swipe area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-4 overflow-hidden">
        {/* Card stack container */}
        <div className="relative w-full max-w-md h-[70vh] max-h-[600px]">
          {/* Background cards */}
          {outfits.slice(currentIndex + 1, currentIndex + 3).map((_, stackIndex) => (
            <div
              key={`stack-${stackIndex}`}
              className="absolute inset-0 swipe-card"
              style={{
                transform: `scale(${1 - (stackIndex + 1) * 0.05}) translateY(${(stackIndex + 1) * 16}px)`,
                zIndex: -stackIndex - 1,
                opacity: 1 - (stackIndex + 1) * 0.2
              }}
            >
              <div className="h-full bg-[#F0F0ED]" />
            </div>
          ))}

          {/* Active card */}
          <AnimatePresence mode="wait">
            {currentOutfit && (
              <motion.div
                key={currentIndex}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: direction !== 0 ? direction * 400 : 0,
                  rotate: direction !== 0 ? direction * 20 : 0
                }}
                exit={{ 
                  x: direction * 400, 
                  rotate: direction * 20,
                  opacity: 0 
                }}
                transition={{ duration: 0.3 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) handleSwipe(1);
                  else if (info.offset.x < -100) handleSwipe(-1);
                }}
                style={{ x, rotate }}
                className="absolute inset-0 swipe-card cursor-grab active:cursor-grabbing flex flex-col"
                data-testid="swipe-card"
              >
                {/* Outfit image area */}
                <div className="flex-1 bg-gradient-to-br from-[#F0F0ED] to-[#E5E5E0] relative overflow-hidden">
                  {tryonImages[currentIndex] ? (
                    <img 
                      src={tryonImages[currentIndex]}
                      alt="Virtual try-on"
                      className="w-full h-full object-cover"
                    />
                  ) : selfPhoto ? (
                    <div className="w-full h-full relative">
                      <img 
                        src={selfPhoto}
                        alt="Your photo"
                        className="w-full h-full object-cover opacity-30"
                      />
                      {/* Collage overlay */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="grid grid-cols-2 gap-2 p-4 max-w-[80%]">
                          {(currentOutfit.items_used || []).slice(0, 4).map((itemIdx, i) => (
                            clothingPreviews[itemIdx] && (
                              <div key={i} className="aspect-square rounded-xl overflow-hidden shadow-lg bg-white">
                                <img 
                                  src={clothingPreviews[itemIdx]}
                                  alt={`Item ${itemIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-[#1C1C1E]/40">Outfit visualization</p>
                    </div>
                  )}
                  
                  {/* Card number indicator */}
                  <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1">
                    <span className="text-sm font-medium text-[#1C1C1E]">
                      {currentIndex + 1} / {outfits.length}
                    </span>
                  </div>

                  {/* Swipe indicators */}
                  <motion.div 
                    style={{ opacity: saveIndicatorOpacity }}
                    className="absolute top-4 left-4 bg-[#7C9E7E] text-white rounded-full px-4 py-2 font-medium"
                  >
                    SAVE
                  </motion.div>
                  <motion.div 
                    style={{ opacity: skipIndicatorOpacity }}
                    className="absolute top-4 right-4 bg-[#1C1C1E]/60 text-white rounded-full px-4 py-2 font-medium"
                  >
                    SKIP
                  </motion.div>
                </div>

                {/* Outfit info */}
                <div className="p-5 bg-white">
                  <h3 className="font-serif text-xl text-[#1C1C1E] mb-2">{currentOutfit.title}</h3>
                  <p className="text-sm text-[#1C1C1E]/60 leading-relaxed mb-4 line-clamp-2">
                    {currentOutfit.why_it_works}
                  </p>
                  
                  {/* Item chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(currentOutfit.items_used || []).map((itemIdx, i) => (
                      clothingPreviews[itemIdx] && (
                        <div 
                          key={i}
                          className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-[#E5E5E0]"
                        >
                          <img 
                            src={clothingPreviews[itemIdx]}
                            alt={`Item ${itemIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            data-testid="dismiss-btn"
            onClick={() => handleSwipe(-1)}
            className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1C1C1E] hover:scale-110 transition-transform active:scale-95"
          >
            <X className="w-7 h-7" />
          </button>
          
          <button
            data-testid="prev-btn"
            onClick={() => goToOutfit(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-[#1C1C1E]/60 hover:text-[#1C1C1E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button
            data-testid="next-btn"
            onClick={() => goToOutfit(currentIndex + 1)}
            disabled={currentIndex === outfits.length - 1}
            className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-[#1C1C1E]/60 hover:text-[#1C1C1E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <button
            data-testid="save-btn"
            onClick={() => handleSwipe(1)}
            className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center text-[#C9908A] hover:scale-110 transition-transform active:scale-95"
          >
            <Heart className="w-7 h-7" fill="currentColor" />
          </button>
        </div>

        {/* Tweak vibe section */}
        <div className="w-full max-w-md mt-6">
          <div className="flex gap-2">
            <Input
              data-testid="tweak-vibe-input"
              value={tweakVibe}
              onChange={(e) => setTweakVibe(e.target.value)}
              placeholder="Tweak the vibe... (e.g. make it more relaxed)"
              className="flex-1 bg-white border-[#E5E5E0] rounded-full px-5 py-3 focus:border-[#7C9E7E] focus:ring-[#7C9E7E]"
            />
            <Button
              data-testid="regenerate-btn"
              onClick={handleTweakVibe}
              disabled={!tweakVibe.trim() || isRegenerating}
              className="bg-[#F0F0ED] hover:bg-[#E5E5E0] text-[#1C1C1E] rounded-full px-4 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Outfit dots indicator */}
        <div className="flex gap-2 mt-4">
          {outfits.map((_, i) => (
            <button
              key={i}
              onClick={() => goToOutfit(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex 
                  ? 'bg-[#7C9E7E] w-4' 
                  : 'bg-[#E5E5E0] hover:bg-[#C9908A]'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default SwipePage;
