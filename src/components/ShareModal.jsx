import React, { useState, useEffect } from 'react';
import { X, Check, Copy, Share2, ExternalLink } from 'lucide-react';
import { resolveApiUrl } from '../services/api';

export default function ShareModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [track, setTrack] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleOpenShare = (e) => {
      if (e.detail) {
        setTrack(e.detail);
        setIsOpen(true);
        setCopied(false);
      }
    };

    window.addEventListener('playloop-open-share', handleOpenShare);
    return () => window.removeEventListener('playloop-open-share', handleOpenShare);
  }, []);

  if (!isOpen || !track) return null;

  const isPlaylist = Boolean(track.isPlaylist || track.type === 'playlist' || (!track.videoId && (track.playlistId || track.id)));
  const title = track.title || (isPlaylist ? 'Playlist' : 'Track');
  const artist = isPlaylist 
    ? (track.author || (track.count ? `${track.count} songs` : 'Play LooP'))
    : (track.artist || track.channelTitle || 'Artist');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://play-loop.onrender.com';
  
  // Clean URL for sharing
  const shareUrl = isPlaylist
    ? `${origin}/#/playlist/${encodeURIComponent(track.playlistId || track.id)}`
    : `${origin}/track/${encodeURIComponent(track.videoId)}`;
  const shareMessage = isPlaylist
    ? `Check out the playlist "${title}" on Play LooP:`
    : `Listen to "${title}" by ${artist} on Play LooP:`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${title} - ${artist}`,
          text: `Listen to "${title}" by ${artist} on Play LooP!`,
          url: shareUrl
        });
      } catch (e) {
        if (e.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const platforms = [
    {
      name: 'WhatsApp',
      iconColor: 'text-[#25D366]',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      ),
      onClick: () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage + ' ' + shareUrl)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Instagram',
      iconColor: 'text-[#E1306C]',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      onClick: async () => {
        await handleCopy();
        window.dispatchEvent(new CustomEvent('playloop-toast', { detail: 'Link copied! Paste in Instagram chat' }));
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = 'instagram://direct-inbox';
          setTimeout(() => {
            window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
          }, 1000);
        } else {
          window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
        }
      }
    },
    {
      name: 'Telegram',
      iconColor: 'text-[#229ED9]',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      onClick: () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'X',
      iconColor: 'text-zinc-200',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      onClick: () => {
        const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Facebook',
      iconColor: 'text-[#1877F2]',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      onClick: () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    {
      name: 'Reddit',
      iconColor: 'text-[#FF4500]',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      ),
      onClick: () => {
        const url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`${title} by ${artist}`)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  ];

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="relative w-full max-w-md bg-zinc-950/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-[0_20px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Share music"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isPlaylist ? 'Share Playlist' : 'Share Song'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isPlaylist ? 'Share this playlist with anyone' : 'Share with friends or copy clean link'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track Preview Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/5 mb-6">
          <img
            src={track.thumbnail || (track.videoId ? resolveApiUrl(`/api/cover?id=${encodeURIComponent(track.videoId)}`) : '/default-cover.svg')}
            alt={title}
            onError={(e) => { e.target.src = '/default-cover.svg'; }}
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10 shadow-md"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate">{title}</h4>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{artist}</p>
            <span className="inline-block mt-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              {isPlaylist ? 'Playlist' : 'Play LooP'}
            </span>
          </div>
        </div>

        {/* Social Platforms Grid */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
            Share To
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {platforms.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={p.onClick}
                className="group flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-150 active:scale-95 cursor-pointer"
                title={`Share on ${p.name}`}
              >
                <div className={`transition-transform duration-200 group-hover:scale-110 ${p.iconColor}`}>
                  {p.icon}
                </div>
                <span 
                  style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  className="text-[11px] font-normal text-zinc-300 group-hover:text-white tracking-normal truncate w-full text-center"
                >
                  {p.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Clean Link Box */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
            Copy to clipboard
          </label>
          <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-2xl bg-black border border-white/10 shadow-inner">
            <span className="text-xs text-zinc-300 font-mono truncate select-all flex-1">
              {shareUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 ${
                copied
                  ? 'bg-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                  : 'bg-white hover:bg-zinc-200 text-black'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* More Options / Native Share Sheet Button (if available) */}
        {hasNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full mt-3.5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> More System Share Options
          </button>
        )}
      </div>
    </div>
  );
}
