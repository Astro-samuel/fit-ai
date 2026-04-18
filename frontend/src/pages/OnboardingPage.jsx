import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Camera, X, ArrowRight, ArrowLeft, Sparkles, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selfPhoto, setSelfPhoto] = useState(null);
  const [selfPhotoFile, setSelfPhotoFile] = useState(null);
  const [clothingItems, setClothingItems] = useState([]);
  const [clothingFiles, setClothingFiles] = useState([]);
  const [vibe, setVibe] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  const selfPhotoInputRef = useRef(null);
  const clothingInputRef = useRef(null);

  const loadingMessages = [
    "Analyzing your vibe...",
    "Studying your wardrobe...",
    "Matching colors and textures...",
    "Curating your looks...",
    "Almost ready..."
  ];

  const handleSelfPhotoUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file");
        return;
      }
      setSelfPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelfPhoto(e.target?.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleClothingUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 5 - clothingItems.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    filesToAdd.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return;
      }
      
      setClothingFiles(prev => [...prev, file]);
      const reader = new FileReader();
      reader.onload = (e) => {
        setClothingItems(prev => [...prev, e.target?.result]);
      };
      reader.readAsDataURL(file);
    });
    
    if (files.length > remainingSlots) {
      toast.info(`Only ${remainingSlots} more items can be added (max 5)`);
    }
  }, [clothingItems.length]);

  const removeClothingItem = useCallback((index) => {
    setClothingItems(prev => prev.filter((_, i) => i !== index));
    setClothingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStyleMe = async () => {
    if (!selfPhotoFile || clothingFiles.length < 3 || !vibe.trim()) {
      toast.error("Please complete all steps before generating outfits");
      return;
    }

    setIsLoading(true);
    let messageIndex = 0;
    setLoadingMessage(loadingMessages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 3000);

    try {
      const formData = new FormData();
      formData.append('vibe', vibe);
      clothingFiles.forEach((file) => {
        formData.append('clothing_images', file);
      });

      const response = await axios.post(`${API}/generate-outfits`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });

      clearInterval(messageInterval);
      
      // Navigate to swipe page with data
      navigate('/swipe', { 
        state: { 
          outfits: response.data.outfits,
          clothingPreviews: response.data.clothing_previews,
          selfPhoto: selfPhoto,
          selfPhotoFile: selfPhotoFile,
          vibe: vibe
        }
      });
      
    } catch (error) {
      clearInterval(messageInterval);
      console.error("Error generating outfits:", error);
      toast.error(error.response?.data?.detail || "Failed to generate outfits. Please try again.");
      setIsLoading(false);
    }
  };

  const canProceedToStep2 = selfPhoto !== null;
  const canProceedToStep3 = clothingItems.length >= 3;
  const canStyleMe = canProceedToStep2 && canProceedToStep3 && vibe.trim().length > 0;

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          {/* Animated card */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-48 h-64 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(28,28,30,0.12)] mx-auto mb-8 overflow-hidden border border-[#E5E5E0]/50"
          >
            <div className="h-3/4 bg-gradient-to-br from-[#7C9E7E]/20 to-[#C9908A]/20 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-[#7C9E7E] animate-pulse" />
            </div>
            <div className="h-1/4 bg-white p-3">
              <div className="w-full h-2 bg-[#F0F0ED] rounded animate-pulse mb-2" />
              <div className="w-2/3 h-2 bg-[#F0F0ED] rounded animate-pulse" />
            </div>
          </motion.div>

          <h2 className="font-serif text-2xl text-[#1C1C1E] mb-2">Building your looks...</h2>
          <motion.p
            key={loadingMessage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[#1C1C1E]/60"
          >
            {loadingMessage}
          </motion.p>
          <p className="text-sm text-[#1C1C1E]/40 mt-4">This takes about 15 seconds</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="w-full px-6 md:px-12 lg:px-16 py-6 flex items-center justify-between">
        <button
          data-testid="back-to-home"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <span className="font-serif text-xl tracking-tight text-[#1C1C1E]">FitAI</span>
        <div className="w-16" /> {/* Spacer */}
      </header>

      {/* Progress indicator */}
      <div className="px-6 md:px-12 lg:px-16 mb-8">
        <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  s < step ? 'bg-[#7C9E7E] text-white' :
                  s === step ? 'bg-[#1C1C1E] text-white' :
                  'bg-[#E5E5E0] text-[#1C1C1E]/40'
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-8 h-0.5 ${s < step ? 'bg-[#7C9E7E]' : 'bg-[#E5E5E0]'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 md:px-12 lg:px-16 pb-8 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Step 1: Self Photo */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#7C9E7E] font-medium mb-3">
                  Step 1 of 3
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1C1E] mb-2">
                  Upload a photo of yourself
                </h2>
                <p className="text-[#1C1C1E]/60 text-sm">
                  Full body works best • Plain background preferred
                </p>
              </div>

              <div 
                data-testid="self-photo-upload"
                onClick={() => selfPhotoInputRef.current?.click()}
                className={`upload-zone rounded-[2rem] p-8 cursor-pointer transition-all ${
                  selfPhoto ? 'border-[#7C9E7E] bg-[#7C9E7E]/5' : ''
                }`}
              >
                <input
                  ref={selfPhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelfPhotoUpload}
                  className="hidden"
                />
                
                {selfPhoto ? (
                  <div className="relative max-w-xs mx-auto">
                    <img 
                      src={selfPhoto} 
                      alt="Your photo" 
                      className="w-full aspect-[3/4] object-cover rounded-2xl"
                    />
                    <button
                      data-testid="remove-self-photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelfPhoto(null);
                        setSelfPhotoFile(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                    >
                      <X className="w-4 h-4 text-[#1C1C1E]" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2 bg-white/90 rounded-lg px-3 py-2 text-center">
                      <p className="text-sm text-[#7C9E7E] font-medium flex items-center justify-center gap-2">
                        <Check className="w-4 h-4" /> Photo uploaded
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-[#F0F0ED] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-8 h-8 text-[#7C9E7E]" />
                    </div>
                    <p className="text-[#1C1C1E] font-medium mb-2">Click to upload your photo</p>
                    <p className="text-sm text-[#1C1C1E]/50">or drag and drop</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  data-testid="step1-next"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                  className="bg-[#7C9E7E] text-white rounded-full px-8 py-3 font-medium hover:bg-[#6A8A6C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Clothing Items */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#7C9E7E] font-medium mb-3">
                  Step 2 of 3
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1C1E] mb-2">
                  Now add your clothes
                </h2>
                <p className="text-[#1C1C1E]/60 text-sm">
                  Upload 3-5 items • One garment per photo
                </p>
              </div>

              {/* Clothing grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {clothingItems.map((item, index) => (
                  <div key={index} className="relative aspect-square">
                    <img 
                      src={item} 
                      alt={`Clothing item ${index + 1}`}
                      className="w-full h-full object-cover rounded-2xl border border-[#E5E5E0]"
                    />
                    <button
                      data-testid={`remove-clothing-${index}`}
                      onClick={() => removeClothingItem(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-[#1C1C1E]" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg px-2 py-1">
                      <span className="text-xs font-medium text-[#1C1C1E]">Item {index + 1}</span>
                    </div>
                  </div>
                ))}
                
                {clothingItems.length < 5 && (
                  <div
                    data-testid="clothing-upload"
                    onClick={() => clothingInputRef.current?.click()}
                    className="upload-zone aspect-square rounded-2xl cursor-pointer flex flex-col items-center justify-center"
                  >
                    <input
                      ref={clothingInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleClothingUpload}
                      className="hidden"
                    />
                    <Plus className="w-8 h-8 text-[#7C9E7E] mb-2" />
                    <span className="text-sm text-[#1C1C1E]/60">Add item</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className={`text-sm ${clothingItems.length >= 3 ? 'text-[#7C9E7E]' : 'text-[#1C1C1E]/50'}`}>
                  {clothingItems.length}/5 items uploaded
                  {clothingItems.length < 3 && ` (minimum 3 required)`}
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  data-testid="step2-back"
                  onClick={() => setStep(1)}
                  variant="ghost"
                  className="text-[#1C1C1E]/60 hover:text-[#1C1C1E] rounded-full px-6"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  data-testid="step2-next"
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
                  className="bg-[#7C9E7E] text-white rounded-full px-8 py-3 font-medium hover:bg-[#6A8A6C] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Vibe Input */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#7C9E7E] font-medium mb-3">
                  Step 3 of 3
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#1C1C1E] mb-2">
                  What's the vibe?
                </h2>
                <p className="text-[#1C1C1E]/60 text-sm">
                  Describe the style you're going for today
                </p>
              </div>

              <div className="max-w-xl mx-auto">
                <Textarea
                  data-testid="vibe-input"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  placeholder="e.g. casual but put-together, low-key date night, relaxed but intentional, professional yet creative..."
                  className="w-full bg-transparent border-2 border-[#E5E5E0] rounded-2xl py-6 px-6 text-lg font-serif focus:outline-none focus:border-[#7C9E7E] placeholder:text-[#1C1C1E]/30 transition-colors resize-none min-h-[150px]"
                />
                
                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {["Casual weekend", "Smart casual", "Date night", "Work from home", "Brunch with friends"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setVibe(suggestion)}
                      className="px-4 py-2 bg-[#F0F0ED] hover:bg-[#E5E5E0] text-[#1C1C1E]/70 text-sm rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  data-testid="step3-back"
                  onClick={() => setStep(2)}
                  variant="ghost"
                  className="text-[#1C1C1E]/60 hover:text-[#1C1C1E] rounded-full px-6"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  data-testid="style-me-btn"
                  onClick={handleStyleMe}
                  disabled={!canStyleMe}
                  className="bg-[#7C9E7E] text-white rounded-full px-10 py-4 text-base font-medium hover:bg-[#6A8A6C] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#7C9E7E]/20"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Style me
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default OnboardingPage;
