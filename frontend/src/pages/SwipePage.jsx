import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Heart, X, ArrowLeft, RefreshCw, Bookmark, ChevronLeft, ChevronRight, Sparkles, Lightbulb } from "lucide-react";
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
  const [clothingFiles, setClothingFiles] = useState([]);
  const [selfPhoto, setSelfPhoto] = useState(null);
  const [selfPhotoFile, setSelfPhotoFile] = useState(null);
  const [currentVibe, setCurrentVibe] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [tweakVibe, setTweakVibe] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState({});
  const [isGeneratingImage, setIsGeneratingImage] = useState({});
  
  const autoGenStarted = useRef(false);

  // Motion values for drag animation
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const saveIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);
  const skipIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);

  const currentOutfit = outfits[currentIndex];

  // Initialize from navigation state
  useEffect(() => {
    if (location.state) {
      setOutfits(location.state.outfits || []);
      setClothingPreviews(location.state.clothingPreviews || []);
      setClothingFiles(location.state.clothingFiles || []);
      setSelfPhoto(location.state.selfPhoto);
      setSelfPhotoFile(location.state.selfPhotoFile);
      setCurrentVibe(location.state.vibe || "");
    } else {
      navigate("/onboarding");
    }
  }, [location.state, navigate]);

  // Generate outfit image - uses user's actual photo
  const generateOutfitImage = useCallback(async (outfitIndex, outfit, personFile, clothFiles, forceRegenerate = false) => {
    if (!outfit || !personFile || isGeneratingImage[outfitIndex]) return;
    if (!forceRegenerate && generatedImages[outfitIndex]) return;
    
    setIsGeneratingImage(prev => ({ ...prev, [outfitIndex]: true }));
    
    try {
      const formData = new FormData();
      formData.append('person_image', personFile);
      formData.append('outfit_description', `${outfit.title}: ${outfit.why_it_works}`);
      formData.append('outfit_title', outfit.title);
      formData.append('items_used', JSON.stringify(outfit.items_used || []));
      formData.append('force_regenerate', forceRegenerate.toString());
      
      const itemsUsed = outfit.items_used || [];
      if (clothFiles.length > 0) {
        itemsUsed.forEach(idx => {
          if (clothFiles[idx]) {
            formData.append('clothing_images', clothFiles[idx]);
          }
        });
      }
      
      const response = await axios.post(`${API}/generate-outfit-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      });
      
      if (response.data.success && response.data.generated_image_url) {
        setGeneratedImages(prev => ({
          ...prev,
          [outfitIndex]: response.data.generated_image_url
        }));
        if (response.data.cached) {
          console.log(`Cache hit for outfit ${outfitIndex}`);
        }
      } else {
        console.error(`Failed to generate image for outfit ${outfitIndex}:`, response.data.error);
      }
    } catch (error) {
      console.error(`Error generating outfit ${outfitIndex}:`, error);
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [outfitIndex]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGeneratingImage, generatedImages]);

  // Retry generation with force flag
  const retryGeneration = async () => {
    if (!currentOutfit || !selfPhotoFile) return;
    // Clear the current image first
    setGeneratedImages(prev => {
      const updated = { ...prev };
      delete updated[currentIndex];
      return updated;
    });
    toast.info("Retrying image generation...");
    await generateOutfitImage(currentIndex, currentOutfit, selfPhotoFile, clothingFiles, true);
  };

  // Auto-generate images for all outfits when data is loaded
  useEffect(() => {
    if (
      location.state?.autoGenerate &&
      outfits.length > 0 &&
      selfPhotoFile &&
      clothingFiles.length > 0 &&
      !autoGenStarted.current
    ) {
      autoGenStarted.current = true;
      toast.info("Generating your outfit images...");
      
      // Generate images sequentially to avoid API rate limits
      const generateSequentially = async () => {
        for (let i = 0; i < outfits.length; i++) {
          await generateOutfitImage(i, outfits[i], selfPhotoFile, clothingFiles);
        }
        toast.success("All outfit images generated!");
      };
      
      generateSequentially();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfits, selfPhotoFile, clothingFiles]);

  const saveLook = async (outfit) => {
    try {
      const itemsUsed = outfit.items_used || [];
      const collageItems = itemsUsed.map(idx => clothingPreviews[idx]).filter(Boolean);
      
      await axios.post(`${API}/saved-looks`, {
        title: outfit.title,
        why_it_works: outfit.why_it_works,
        vibe_match: outfit.vibe_match,
        items_used: itemsUsed,
        generated_image_url: generatedImages[currentIndex] || null,
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

  const handleSwipe = useCallback((dir) => {
    if (!currentOutfit) return;
    
    setDirection(dir);
    
    if (dir === 1) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOutfit, currentIndex, outfits.length]);

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
    navigate("/onboarding", {
      state: {
        prefillVibe: `${currentVibe}. ${tweakVibe}`,
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

      {/* Batch generation progress */}
      {outfits.length > 0 && (() => {
        const generatedCount = Object.keys(generatedImages).length;
        const totalCount = outfits.length;
        const progressPercent = Math.round((generatedCount / totalCount) * 100);
        const isBatchGenerating = Object.values(isGeneratingImage).some(v => v) || generatedCount < totalCount;
        
        if (!isBatchGenerating && generatedCount === totalCount) return null;
        
        return (
          <div className="px-4 md:px-8 pb-2" data-testid="batch-progress">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#1C1C1E]/60 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#7C9E7E]" />
                  {generatedCount === totalCount 
                    ? 'All outfits generated!' 
                    : `Generating outfits... ${generatedCount}/${totalCount}`}
                </span>
                <span className="text-xs font-medium text-[#7C9E7E]">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#E5E5E0] rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-[#7C9E7E] to-[#C9908A]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main swipe area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-4 overflow-hidden">
        {/* Bigger card stack container - 85vh with max for larger images */}
        <div className="relative w-full max-w-lg h-[82vh] max-h-[800px]">
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
                {/* Outfit image area - 80% of card for full body view */}
                <div className="flex-[4] bg-gradient-to-br from-[#F0F0ED] to-[#E5E5E0] relative overflow-hidden">
                  {generatedImages[currentIndex] ? (
                    <>
                      <img 
                        src={generatedImages[currentIndex]}
                        alt="AI Generated outfit on you"
                        className="w-full h-full object-cover"
                      />
                      {/* Retry button */}
                      <button
                        data-testid="retry-generation-btn"
                        onClick={retryGeneration}
                        disabled={isGeneratingImage[currentIndex]}
                        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-[#1C1C1E] px-3 py-2 rounded-full text-xs font-medium shadow-lg hover:bg-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingImage[currentIndex] ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                    </>
                  ) : isGeneratingImage[currentIndex] ? (
                    <div className="w-full h-full relative flex items-center justify-center">
                      {selfPhoto && (
                        <img 
                          src={selfPhoto}
                          alt="Your photo"
                          className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm"
                        />
                      )}
                      <div className="relative text-center z-10">
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Sparkles className="w-8 h-8 text-[#7C9E7E] animate-pulse" />
                        </div>
                        <p className="text-[#1C1C1E] font-medium bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 inline-block">
                          Generating your fit...
                        </p>
                      </div>
                    </div>
                  ) : selfPhoto ? (
                    <div className="w-full h-full relative">
                      <img 
                        src={selfPhoto}
                        alt="Your photo"
                        className="w-full h-full object-cover opacity-40"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="grid grid-cols-2 gap-2 p-4 max-w-[70%]">
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
                    className="absolute top-4 right-16 bg-[#1C1C1E]/60 text-white rounded-full px-4 py-2 font-medium"
                  >
                    SKIP
                  </motion.div>
                </div>

                {/* Outfit info - compact bottom section */}
                <div className="p-4 bg-white shrink-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif text-lg text-[#1C1C1E] line-clamp-1">{currentOutfit.title}</h3>
                        {currentOutfit.aesthetic_score && (
                          <span className="shrink-0 text-xs bg-[#7C9E7E]/10 text-[#7C9E7E] px-2 py-0.5 rounded-full font-medium">
                            {currentOutfit.aesthetic_score}/10
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Item chips */}
                    <div className="flex gap-1.5 shrink-0">
                      {(currentOutfit.items_used || []).slice(0, 4).map((itemIdx, i) => (
                        clothingPreviews[itemIdx] && (
                          <div 
                            key={i}
                            className="w-7 h-7 rounded-md overflow-hidden border border-[#E5E5E0]"
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
                  <p className="text-xs text-[#1C1C1E]/60 leading-relaxed line-clamp-2">
                    {currentOutfit.why_it_works}
                  </p>
                  {currentOutfit.suggestions && currentOutfit.suggestions.trim() && (
                    <div className="mt-2 pt-2 border-t border-[#E5E5E0]/60 flex items-start gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-[#C9908A] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#1C1C1E]/70 line-clamp-2 italic">
                        {currentOutfit.suggestions}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons - compact */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            data-testid="dismiss-btn"
            onClick={() => handleSwipe(-1)}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1C1C1E] hover:scale-110 transition-transform active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
          
          <button
            data-testid="prev-btn"
            onClick={() => goToOutfit(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#1C1C1E]/60 hover:text-[#1C1C1E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            data-testid="next-btn"
            onClick={() => goToOutfit(currentIndex + 1)}
            disabled={currentIndex === outfits.length - 1}
            className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[#1C1C1E]/60 hover:text-[#1C1C1E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            data-testid="save-btn"
            onClick={() => handleSwipe(1)}
            className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-[#C9908A] hover:scale-110 transition-transform active:scale-95"
          >
            <Heart className="w-6 h-6" fill="currentColor" />
          </button>
        </div>

        {/* Tweak vibe section */}
        <div className="w-full max-w-lg mt-3">
          <div className="flex gap-2">
            <Input
              data-testid="tweak-vibe-input"
              value={tweakVibe}
              onChange={(e) => setTweakVibe(e.target.value)}
              placeholder="Tweak the vibe..."
              className="flex-1 bg-white border-[#E5E5E0] rounded-full px-4 py-2 text-sm focus:border-[#7C9E7E] focus:ring-[#7C9E7E]"
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
        <div className="flex gap-2 mt-3">
          {outfits.map((_, i) => (
            <button
              key={i}
              onClick={() => goToOutfit(i)}
              className={`h-2 rounded-full transition-all ${
                i === currentIndex 
                  ? 'bg-[#7C9E7E] w-6' 
                  : generatedImages[i] 
                    ? 'bg-[#C9908A] w-2'
                    : 'bg-[#E5E5E0] w-2 hover:bg-[#C9908A]'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default SwipePage;
