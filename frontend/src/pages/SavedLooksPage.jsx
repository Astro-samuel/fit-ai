import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/App";
import axios from "axios";

const SavedLooksPage = () => {
  const navigate = useNavigate();
  const [savedLooks, setSavedLooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSavedLooks();
  }, []);

  const fetchSavedLooks = async () => {
    try {
      const response = await axios.get(`${API}/saved-looks`);
      setSavedLooks(response.data);
    } catch (error) {
      console.error("Error fetching saved looks:", error);
      toast.error("Failed to load saved looks");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLook = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API}/saved-looks/${id}`);
      setSavedLooks(prev => prev.filter(look => look.id !== id));
      toast.success("Look removed");
    } catch (error) {
      console.error("Error deleting look:", error);
      toast.error("Failed to delete look");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Header */}
      <header className="w-full px-6 md:px-12 lg:px-16 py-6 flex items-center justify-between border-b border-[#E5E5E0]">
        <button
          data-testid="back-to-home"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-[#1C1C1E]/60 hover:text-[#1C1C1E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Home</span>
        </button>
        <span className="font-serif text-xl tracking-tight text-[#1C1C1E]">FitAI</span>
        <div className="w-16" />
      </header>

      {/* Main content */}
      <main className="px-6 md:px-12 lg:px-16 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page title */}
          <div className="text-center mb-12">
            <p className="text-xs font-sans uppercase tracking-[0.2em] text-[#7C9E7E] font-medium mb-3">
              Your Collection
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C1E] mb-2">
              Saved Looks
            </h1>
            <p className="text-[#1C1C1E]/60">
              {savedLooks.length > 0 
                ? `${savedLooks.length} outfit${savedLooks.length !== 1 ? 's' : ''} saved`
                : "Your saved outfits will appear here"}
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#7C9E7E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#1C1C1E]/60">Loading your looks...</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && savedLooks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-[#F0F0ED] rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-10 h-10 text-[#C9908A]" />
              </div>
              <h2 className="font-serif text-2xl text-[#1C1C1E] mb-3">Nothing saved yet</h2>
              <p className="text-[#1C1C1E]/60 mb-8 max-w-sm mx-auto">
                Go find your fit! Swipe right on outfits you love to save them here.
              </p>
              <Button
                data-testid="start-styling-btn"
                onClick={() => navigate("/onboarding")}
                className="bg-[#7C9E7E] text-white rounded-full px-8 py-3 font-medium hover:bg-[#6A8A6C] transition-all"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Start styling
              </Button>
            </motion.div>
          )}

          {/* Saved looks grid */}
          {!isLoading && savedLooks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence>
                {savedLooks.map((look, index) => (
                  <motion.div
                    key={look.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    data-testid={`saved-look-${look.id}`}
                    className="bg-white rounded-[1.5rem] shadow-[0_10px_30px_rgba(28,28,30,0.06)] overflow-hidden border border-[#E5E5E0]/50 group"
                  >
                    {/* Image area */}
                    <div className="aspect-[4/5] bg-gradient-to-br from-[#F0F0ED] to-[#E5E5E0] relative overflow-hidden">
                      {look.tryon_image_url ? (
                        <img 
                          src={look.tryon_image_url}
                          alt={look.title}
                          className="w-full h-full object-cover"
                        />
                      ) : look.collage_items && look.collage_items.length > 0 ? (
                        <div className="w-full h-full p-4 flex items-center justify-center">
                          <div className="grid grid-cols-2 gap-2 max-w-[90%]">
                            {look.collage_items.slice(0, 4).map((item, i) => (
                              <div 
                                key={i}
                                className="aspect-square rounded-xl overflow-hidden bg-white shadow-md"
                              >
                                <img 
                                  src={item}
                                  alt={`Item ${i + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="w-12 h-12 text-[#C9908A]/30" />
                        </div>
                      )}

                      {/* Delete button */}
                      <button
                        data-testid={`delete-look-${look.id}`}
                        onClick={() => deleteLook(look.id)}
                        disabled={deletingId === look.id}
                        className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-[#1C1C1E]/50 hover:text-red-500 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        {deletingId === look.id ? (
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>

                      {/* Saved badge */}
                      <div className="absolute top-3 left-3 bg-[#C9908A] text-white rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1">
                        <Heart className="w-3 h-3" fill="currentColor" />
                        Saved
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-serif text-lg text-[#1C1C1E] mb-2 line-clamp-1">
                        {look.title}
                      </h3>
                      <p className="text-sm text-[#1C1C1E]/60 leading-relaxed line-clamp-2">
                        {look.why_it_works}
                      </p>
                      
                      {/* Vibe match tag */}
                      {look.vibe_match && (
                        <div className="mt-3 inline-flex items-center gap-1 bg-[#F0F0ED] rounded-full px-3 py-1 text-xs text-[#1C1C1E]/70">
                          <Sparkles className="w-3 h-3 text-[#7C9E7E]" />
                          {look.vibe_match.length > 40 
                            ? look.vibe_match.substring(0, 40) + "..." 
                            : look.vibe_match}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Bottom CTA */}
          {!isLoading && savedLooks.length > 0 && (
            <div className="text-center mt-12">
              <Button
                data-testid="create-more-btn"
                onClick={() => navigate("/onboarding")}
                variant="outline"
                className="border-[#7C9E7E] text-[#7C9E7E] hover:bg-[#7C9E7E] hover:text-white rounded-full px-8 py-3 transition-all"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create more outfits
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedLooksPage;
