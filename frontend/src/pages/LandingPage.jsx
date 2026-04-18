import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="w-full px-6 md:px-12 lg:px-16 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-serif text-2xl tracking-tight text-[#1C1C1E]">FitAI</span>
        </div>
        <button
          data-testid="saved-looks-nav"
          onClick={() => navigate("/saved")}
          className="text-sm font-medium text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors flex items-center gap-2"
        >
          <Heart className="w-4 h-4" />
          Saved Looks
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center px-6 md:px-12 lg:px-16 py-8 lg:py-0 gap-12 lg:gap-24">
        {/* Left: Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 max-w-xl text-center lg:text-left"
        >
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#7C9E7E] font-medium mb-6">
            AI-Powered Styling
          </p>
          
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-[#1C1C1E] leading-[1.1] mb-6">
            Wear what you own.
            <br />
            <span className="text-[#7C9E7E]">Look like yourself.</span>
          </h1>
          
          <p className="text-base sm:text-lg font-sans text-[#1C1C1E]/70 leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
            Upload your clothes, describe your vibe, see the outfit on you. 
            No shopping required — just your wardrobe, styled smarter.
          </p>

          <Button
            data-testid="try-it-now-btn"
            onClick={() => navigate("/onboarding")}
            className="bg-[#7C9E7E] text-white rounded-full px-10 py-6 text-base font-medium hover:bg-[#6A8A6C] transition-all hover:scale-105 shadow-lg shadow-[#7C9E7E]/20"
          >
            Try it now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="flex items-center justify-center lg:justify-start gap-6 mt-8 text-sm text-[#1C1C1E]/50">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9908A]" />
              AI-powered
            </span>
            <span>•</span>
            <span>Free to try</span>
            <span>•</span>
            <span>No signup</span>
          </div>
        </motion.div>

        {/* Right: Mock Swipe Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1 max-w-md w-full relative"
        >
          {/* Background cards for stack effect */}
          <div className="absolute inset-0 translate-y-8 scale-[0.92] bg-white rounded-[2rem] shadow-lg opacity-40" />
          <div className="absolute inset-0 translate-y-4 scale-[0.96] bg-white rounded-[2rem] shadow-lg opacity-60" />
          
          {/* Main card */}
          <div className="relative bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(28,28,30,0.12)] overflow-hidden border border-[#E5E5E0]/50">
            {/* Mock outfit image */}
            <div className="aspect-[3/4] bg-gradient-to-br from-[#F0F0ED] to-[#E5E5E0] flex items-center justify-center relative overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1513188447171-ecf00455f051?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZmFzaGlvbiUyMHdvbWFuJTIwb3V0Zml0fGVufDB8fHx8MTc3NjQ5NDM5MHww&ixlib=rb-4.1.0&q=85"
                alt="Fashion preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            
            {/* Card info */}
            <div className="p-6 bg-white">
              <h3 className="font-serif text-xl text-[#1C1C1E] mb-2">Effortless Weekend</h3>
              <p className="text-sm text-[#1C1C1E]/60 leading-relaxed">
                The neutral tones keep it relaxed while the structured silhouette adds polish...
              </p>
              
              {/* Mock item chips */}
              <div className="flex gap-2 mt-4">
                {[1, 2, 3].map((i) => (
                  <div 
                    key={i}
                    className="w-10 h-10 rounded-lg bg-[#F0F0ED] border border-[#E5E5E0]"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons preview */}
          <div className="flex justify-center gap-6 mt-6">
            <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-[#1C1C1E]/30">
              ✕
            </div>
            <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center text-[#C9908A]">
              <Heart className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-16 py-6 text-center">
        <p className="text-xs text-[#1C1C1E]/40">
          Powered by AI • Your photos are processed securely and never stored
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
