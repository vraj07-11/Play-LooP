import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export default function GlobalToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleToast = (e) => {
      const msg = typeof e.detail === 'string' ? e.detail : e.detail?.message;
      if (!msg) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast(msg);

      timerRef.current = setTimeout(() => {
        setToast(null);
      }, 2600);
    };

    window.addEventListener('playloop-toast', handleToast);
    return () => {
      window.removeEventListener('playloop-toast', handleToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-900/95 text-white border border-zinc-700/80 rounded-full shadow-2xl backdrop-blur-xl text-xs sm:text-sm font-medium tracking-tight">
        <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
        </div>
        <span className="truncate max-w-[280px] sm:max-w-md">{toast}</span>
      </div>
    </div>
  );
}
