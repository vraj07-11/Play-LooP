import React, { useState, useEffect } from 'react';
import { Globe, Check, ChevronRight } from 'lucide-react';

const LANGUAGES = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'gujarati', label: 'Gujarati' },
  { id: 'punjabi', label: 'Punjabi' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'spanish', label: 'Spanish' },
  { id: 'marathi', label: 'Marathi' },
];

export default function LanguageSelector({ onComplete }) {
  const [selected, setSelected] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('preferred_languages');
    if (!saved) {
      setIsVisible(true);
      // Auto-select English and Hindi by default just to guide them
      setSelected(['english', 'hindi']);
    } else {
      onComplete(JSON.parse(saved));
    }
  }, []);

  const toggleLanguage = (id) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    localStorage.setItem('preferred_languages', JSON.stringify(selected));
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete(selected);
    }, 400); // fade out duration
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-400 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`bg-neutral-900 border border-white/10 rounded-2xl p-8 w-[90%] max-w-md shadow-2xl transition-transform duration-400 transform ${isClosing ? 'scale-95 translate-y-4' : 'scale-100 translate-y-0'}`}>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-white/5 rounded-full text-white">
            <Globe size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Choose Languages</h2>
            <p className="text-sm text-neutral-400">Select what you want to listen to</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {LANGUAGES.map((lang) => {
            const isSelected = selected.includes(lang.id);
            return (
              <button
                key={lang.id}
                onClick={() => toggleLanguage(lang.id)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                  isSelected 
                    ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                    : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="font-medium">{lang.label}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                  isSelected ? 'bg-black border-black text-white' : 'border-white/30 text-transparent'
                }`}>
                  <Check size={12} strokeWidth={3} />
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className="w-full py-4 rounded-full bg-white text-black font-bold text-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          Continue <ChevronRight size={20} />
        </button>

      </div>
    </div>
  );
}
