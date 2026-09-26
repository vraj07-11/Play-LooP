import React, { useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Play, RotateCw } from 'lucide-react';

export default function RightSidebar() {
  const { 
    isRightSidebarOpen, pendingTrack, trackQueue, selectAndPlayTrack, 
    isShuffleEnabled, upcomingTrack, recommendationQueue,
    stableShuffledQueue, trackHistory, shuffleCycleStartIndex,
    isRefreshingUpNext, refreshUpNext
  } = usePlayer();

  // We need the selectedPlaylist information if we are inside a playlist, 
  // but since this sidebar is now global, we can rely mostly on the player's queue.
  // For visual similarity with the mockup, we use pendingTrack
  const nowPlayingTrack = pendingTrack;



  const nextUpTracks = useMemo(() => {
    let tracks = [];
    const activeQueue = trackQueue?.length > 0 ? trackQueue : recommendationQueue;
    
    if (!activeQueue || activeQueue.length === 0) return tracks;

    if (isShuffleEnabled) {
      if (upcomingTrack) {
        tracks.push(upcomingTrack);
      }
      const currentCycleHistory = trackHistory?.slice(shuffleCycleStartIndex) || [];
      const remaining = stableShuffledQueue?.filter(t => 
        t.videoId !== pendingTrack?.videoId && 
        t.videoId !== upcomingTrack?.videoId &&
        !currentCycleHistory.some(ht => ht.videoId === t.videoId)
      ) || [];
      tracks = [...tracks, ...remaining].slice(0, 9);
    } else {
      if (pendingTrack) {
        const currentIndex = activeQueue.findIndex(t => t.videoId === pendingTrack.videoId);
        if (currentIndex !== -1) {
          tracks = activeQueue.slice(currentIndex + 1, currentIndex + 10);
        } else {
          tracks = activeQueue.slice(0, 9);
        }
      } else {
        tracks = activeQueue.slice(0, 9);
      }
    }
    return tracks;
  }, [trackQueue, recommendationQueue, pendingTrack, isShuffleEnabled, upcomingTrack, stableShuffledQueue, trackHistory, shuffleCycleStartIndex]);

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <aside 
      className={`absolute right-0 top-0 h-full z-40 shadow-2xl hidden lg:block shrink-0 bg-[#0a0a0a] transition-[width,opacity] duration-300 ease-in-out overflow-hidden ${
        isRightSidebarOpen 
          ? 'w-[320px] xl:w-[360px] border-l border-zinc-800/40 opacity-100' 
          : 'w-0 opacity-0 border-transparent'
      }`}
    >
      <div className="w-[320px] xl:w-[360px] h-full overflow-y-auto hide-scrollbar p-6 pb-8 select-none flex flex-col gap-10">
      {/* Now Playing */}
      <div>
        <h3 className="text-xl font-bold text-white mb-6">Now Playing</h3>
        {nowPlayingTrack ? (
          <div className="bg-[#181818] rounded-xl p-4 border border-zinc-800/60 shadow-lg">
            <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-4 bg-zinc-900 shadow-md">
              <img 
                src={nowPlayingTrack.thumbnail || '/logo.svg'} 
                alt={nowPlayingTrack.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/logo.svg';
                  e.target.className = 'w-full h-full object-contain p-4 bg-zinc-900';
                }}
              />
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                 <div className="flex items-end gap-[2px] h-3">
                   <div className="w-1 bg-white h-[60%] animate-pulse"></div>
                   <div className="w-1 bg-white h-[100%] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                   <div className="w-1 bg-white h-[40%] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                 </div>
              </div>
            </div>
            <div className="flex justify-between items-start mb-1">
              <div className="flex-1 min-w-0 pr-3">
                <h4 className="text-lg font-bold text-white truncate">{nowPlayingTrack.title}</h4>
                <p className="text-sm text-zinc-400 truncate">{nowPlayingTrack.artist}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#181818] rounded-xl p-6 border border-zinc-800/60 text-center text-zinc-500 text-sm">
            Nothing playing right now.
          </div>
        )}
      </div>

      {/* Next Up */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Next Up</h3>
          <button
            type="button"
            onClick={refreshUpNext}
            disabled={isRefreshingUpNext}
            title="Refresh recommendations"
            aria-label="Refresh recommendations"
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-full transition-colors flex items-center justify-center disabled:opacity-50 group"
          >
            <RotateCw className={`w-4 h-4 transition-transform ${isRefreshingUpNext ? 'animate-spin text-green-500' : 'group-hover:rotate-180 duration-500'}`} />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {nextUpTracks.length > 0 ? (
            nextUpTracks.map((track, i) => (
              <article 
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/40 transition group cursor-pointer"
                onClick={() => selectAndPlayTrack(track.videoId, track.title, track.artist, track.thumbnail)}
              >
                <span className="w-4 text-xs font-medium text-zinc-500 text-right group-hover:hidden">
                  {i + 1}
                </span>
                <span className="w-4 text-xs font-medium text-white text-right hidden group-hover:block">
                  <Play className="w-3 h-3 fill-current" />
                </span>
                <img 
                  src={track.thumbnail || '/logo.svg'} 
                  alt={track.title}
                  className="w-10 h-10 rounded shrink-0 object-cover bg-zinc-900"
                  onError={(e) => {
                    e.target.src = '/logo.svg';
                    e.target.className = 'w-10 h-10 rounded shrink-0 object-contain p-1 bg-zinc-900';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white truncate">{track.title}</h4>
                  <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                </div>
                <span className="text-xs text-zinc-500 font-medium">
                  {formatDuration(track.duration || (180 + Math.floor(Math.random() * 60)))}
                </span>
              </article>
            ))
          ) : (
            <p className="text-zinc-500 text-sm py-4">No tracks queued.</p>
          )}
        </div>
      </div>
      </div>
    </aside>
  );
}
