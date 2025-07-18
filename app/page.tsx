 'use client'

import React, { useState, createContext, useContext, useEffect,useRef } from 'react';
import { Home as HomeIcon, Search, Settings } from 'lucide-react';
import HomePage from '@/components/HomePage';
import SearchPage from '@/components/SearchPage';
import SettingsPage from '@/components/SettingsPage';
import PlaylistsPage from '@/components/PlaylistsPage';
import LikedSongsPage from '@/components/LikedSongsPage';
import MinimizedPlayer from '@/components/MinimizedPlayer';
import MaximizedPlayer from '@/components/MaximizedPlayer';
import CreatePlaylistModal from '@/components/CreatePlaylistModal';
import AddToPlaylistModal from '@/components/AddToPlaylistModal';
import AuthWrapper from '@/components/AuthWrapper';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useQueue } from '@/hooks/useQueue';
import { Song } from '@/types';
import { useTheme } from '@/components/ThemeContext';
import {Toaster,toast} from 'react-hot-toast';


function MusicPlayerContent() {
  const { user } = useAuth();
  const {
    songs,
    playlists,
    likedSongs,
    lastPlayedSong,
    loading,
    toggleLike,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
    recordListeningHistory,
    stopCurrentSongTracking,
    getPersonalizedSongs
  } = useSupabaseData(user);
  
  const {
    queue,
    addToQueue,
    removeFromQueue,
    getNextSongFromQueue,
    clearQueue,
    hasQueue
  } = useQueue();

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'settings'>('home');
  const [currentPage, setCurrentPage] = useState<'main' | 'playlists' | 'liked'>('main');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerMaximized, setIsPlayerMaximized] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<Song | null>(null);
  const [hasSetLastPlayedSong, setHasSetLastPlayedSong] = useState(false);
  const [lastPlayedSongDismissed, setLastPlayedSongDismissed] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const [displayCount, setDisplayCount] = useState(15);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.75); // default 75%
  const [isSeeking, setIsSeeking] = useState(false);
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);
  const [isExternallySeeking, setIsExternallySeeking] = useState(false);
  const [recommendedQueue, setRecommendedQueue] = useState<Song[]>([])
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set())  
  const [personalizedList, setPersonalizedList] = useState<Song[]>([]);
  
const loadMoreSongs = () => {
  setDisplayCount(prev => prev + 15);
};

const displayedSongs = songs.slice(0, displayCount);
useEffect(() => {
  const loadAudio = async () => {
    if (currentSong?.file_id) {
      const url = `/api/audio-proxy?fileid=${currentSong.file_id}`;
      setAudioUrl(url);

      setDuration(0);
      setCurrentTime(0);
      setPendingSeekTime(null);
    }
  };

  loadAudio();
}, [currentSong?.file_id]);

useEffect(() => {
    const fetchRecommendations = async () => {
      if (user && currentSong) {
        const recommendations = await getPersonalizedSongs(user.id, currentSong)
        console.log('🎧 Updated Recommendations:', recommendations)
      }
    }

    fetchRecommendations()
  }, [user, currentSong])

useEffect(() => {
  if (audioRef.current) {
    audioRef.current.volume = volume;
  }
}, [volume]);

useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  if (!isNaN(audio.duration) && isPlaying) {
    // Duration is valid, safe to play
    audio.play().catch((e) => {
      console.error('Playback error:', e);
    });
  } else if (!isPlaying) {
    audio.pause();
  }
}, [isPlaying]);




// Load images for currently displayed songs
useEffect(() => {
  const fetchImages = async () => {
    const newUrls: Record<string, string> = {};

    // Songs from the main feed
    const songsToLoad = songs.slice(0, displayCount);
    for (const song of songsToLoad) {
      if (!imageUrls[song.id]) {
        newUrls[song.id] = `/api/image-proxy?fileid=${song.img_id}`;
      }
    }

    // Songs from playlists
    for (const playlist of playlists) {
      for (const song of playlist.songs) {
        if (!imageUrls[song.id]) {
          newUrls[song.id] = `/api/image-proxy?fileid=${song.img_id}`;
        }
      }
    }

    // Liked songs
    for (const song of likedSongs) {
      if (!imageUrls[song.id]) {
        newUrls[song.id] = `/api/image-proxy?fileid=${song.img_id}`;
      }
    }

    // Apply if new URLs found
    if (Object.keys(newUrls).length > 0) {
      setImageUrls(prev => ({ ...prev, ...newUrls }));
    }
  };

  fetchImages();
}, [displayCount, songs, playlists, likedSongs]);



  // Set last played song as current song when data loads (only once and if not dismissed)
useEffect(() => {
  const loadLastPlayedImage = async () => {
   if (user && lastPlayedSong && !hasSetLastPlayedSong && !lastPlayedSongDismissed) {
      const initialRecs = await getPersonalizedSongs(user.id, lastPlayedSong);
      const filtered = initialRecs.filter(song => !playedSongs.has(song.file_id));
      setPersonalizedList([lastPlayedSong, ...filtered.slice(0, 5)]);
      setCurrentSong(lastPlayedSong);
      setHasSetLastPlayedSong(true);


      if (!imageUrls[lastPlayedSong.img_id]) {
        const url = `/api/image-proxy?fileid=${lastPlayedSong.img_id}`;
        setImageUrls((prev) => ({
          ...prev,
          [lastPlayedSong.img_id]: url
        }));
      }
    }
  };

  loadLastPlayedImage();
}, [lastPlayedSong, currentSong, hasSetLastPlayedSong, lastPlayedSongDismissed, imageUrls]);


const handleSongPlay = async (song: Song) => {
  setCurrentSong(song);
  setIsPlaying(true);
  setLastPlayedSongDismissed(false);
  recordListeningHistory(song.id);

  setPlayedSongs((prev) => {
    const updated = new Set(prev);
    updated.add(String(song.file_id));
    return updated;
  });

  if (user) {
    const recs = await getPersonalizedSongs(user.id, song);
    const filtered = recs.filter(s => !playedSongs.has(s.file_id));
    setPersonalizedList([song, ...filtered.slice(0, 5)]);
  }
};


  const handleAddToQueue = (song: Song) => {
  addToQueue(song);
  toast.success(`Added "${song.name}" to queue`);
};

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const togglePlayerSize = () => {
    setIsPlayerMaximized(!isPlayerMaximized);
  };

  const closePlayer = async () => {
    // Stop tracking current song before closing
    await stopCurrentSongTracking();
    setCurrentSong(null);
    setIsPlaying(false);
    setIsPlayerMaximized(false);
    
    // Mark last played song as dismissed so it won't auto-load again
    setLastPlayedSongDismissed(true);
  };

  const handleToggleLike = (songId: string) => {
    toggleLike(songId);
    
    // Update current song state if it's the one being liked/unliked
    if (currentSong && currentSong.id === songId) {
      setCurrentSong(prev => prev ? { ...prev, isLiked: !prev.isLiked } : null);
    }
  };

const handlePrevious = () => {
  if (!currentSong) return;

  const currentIndex = personalizedList.findIndex(song => song.id === currentSong.id);
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
  const prevSong = personalizedList[prevIndex];

  // Only play if it's not the same as current
  if (prevSong && prevSong.id !== currentSong.id) {
    setCurrentSong(prevSong);
    setIsPlaying(true);
    setLastPlayedSongDismissed(false);
    recordListeningHistory(prevSong.id);

    setPlayedSongs((prev) => {
      const updated = new Set(prev);
      updated.add(String(prevSong.file_id));
      return updated;
    });

    // Preload image
    if (!imageUrls[prevSong.img_id]) {
      const newUrl = `/api/image-proxy?fileid=${prevSong.img_id}`;
      setImageUrls(prev => ({ ...prev, [prevSong.img_id]: newUrl }));
    }
  }
};

useEffect(() => {
  if (!currentSong) return;

  const currentIndex = songs.findIndex(song => song.id === currentSong.id);
  const nextIndex = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
  const nextSong = songs[nextIndex];

  // Preload next song image if not in cache
  if (nextSong && !imageUrls[nextSong.img_id]) {
    const newUrl = `/api/image-proxy?fileid=${nextSong.img_id}`;
    setImageUrls(prev => ({ ...prev, [nextSong.img_id]: newUrl }));
  }
}, [currentSong, songs]);

const handleLoadedMetadata = async () => {
  const audio = audioRef.current;
  if (!audio) return;

  const loadedDuration = audio.duration;

  if (!isNaN(loadedDuration) && isFinite(loadedDuration)) {
    setDuration(loadedDuration);

    if (pendingSeekTime !== null) {
      audio.currentTime = pendingSeekTime;
      setCurrentTime(pendingSeekTime);
      setPendingSeekTime(null);
    } else {
      setCurrentTime(audio.currentTime);
    }

    try {
      if (isPlaying) {
        await audio.play();
      }
    } catch (err) {
      console.error('Auto-play error after metadata load:', err);
    }

  } else {
    // Retry metadata read
    setTimeout(handleLoadedMetadata, 100);
  }
};



const handleNext = async () => {
  if (!currentSong) return;

  // Check if there's a song in the queue first
  const nextQueueSong = getNextSongFromQueue();
  if (nextQueueSong) {
    setCurrentSong(nextQueueSong);
    setIsPlaying(true);
    setLastPlayedSongDismissed(false);
    recordListeningHistory(nextQueueSong.id);
    
    // Preload image
    if (!imageUrls[nextQueueSong.img_id]) {
      const newUrl = `/api/image-proxy?fileid=${nextQueueSong.img_id}`;
      setImageUrls(prev => ({ ...prev, [nextQueueSong.img_id]: newUrl }));
    }
    return;
  }

  // If no queue, proceed with normal next song logic
   const currentIndex = personalizedList.findIndex(song => song.id === currentSong.id);
  const nextIndex = currentIndex + 1;

  if (nextIndex < personalizedList.length) {
    const nextSong = personalizedList[nextIndex];
    setCurrentSong(nextSong);
    setIsPlaying(true);
    setLastPlayedSongDismissed(false);
    recordListeningHistory(nextSong.id);

    // Preload image
    if (!imageUrls[nextSong.img_id]) {
      const newUrl = `/api/image-proxy?fileid=${nextSong.img_id}`;
      setImageUrls(prev => ({ ...prev, [nextSong.img_id]: newUrl }));
    }

    // If nearing end, fetch more
    if (nextIndex >= personalizedList.length - 2 && user) {
      const newRecs = await getPersonalizedSongs(user.id, nextSong);
      const filtered = newRecs.filter(song => !playedSongs.has(song.file_id));
      if (filtered.length > 0) {
        setPersonalizedList(prev => [...prev, ...filtered.slice(0, 5)]);
      }
    }
  }
};




  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleAddToPlaylist = (song: Song) => {
    setSelectedSongForPlaylist(song);
    setShowAddToPlaylistModal(true);
  };

  const handleSongEnd = async () => {
  if (recommendedQueue.length > 0) {
    const next = recommendedQueue[0];
    setRecommendedQueue((prev) => prev.slice(1));
    handleSongPlay(next);
  } else {
    if (currentSong && user) {
      const newRecs = await getPersonalizedSongs(user.id, currentSong);
      const filtered = newRecs.filter(
        (s) => !playedSongs.has(s.file_id)
      );
      const nextQueue = filtered.slice(0, 5);

      if (nextQueue.length > 0) {
        setRecommendedQueue(nextQueue.slice(1));
        handleSongPlay(nextQueue[0]);
      }
    }
  }
};

  const renderContent = () => {
    if (currentPage === 'playlists') {
      return (
        <PlaylistsPage 
          playlists={playlists} 
          onBack={() => setCurrentPage('main')} 
          onSongPlay={handleSongPlay}
          onAddToQueue={handleAddToQueue}
          onCreatePlaylist={() => setShowCreatePlaylistModal(true)}
          onDeletePlaylist={deletePlaylist}
          onRenamePlaylist={renamePlaylist}
          onRemoveSongFromPlaylist={removeSongFromPlaylist}
          imageUrls={imageUrls}
        />
      );
    }
    
    if (currentPage === 'liked') {
      return <LikedSongsPage songs={likedSongs} onBack={() => setCurrentPage('main')} onSongPlay={handleSongPlay} onAddToQueue={handleAddToQueue} imageUrls={imageUrls}/>;
    }

    switch (activeTab) {
      case 'home':
        return <HomePage
                songs={displayedSongs}
                onSongPlay={handleSongPlay}
                formatNumber={formatNumber}
                onAddToPlaylist={handleAddToPlaylist}
                onAddToQueue={handleAddToQueue}
                imageUrls={imageUrls}
                onLoadMore={loadMoreSongs}
                hasMoreSongs={displayCount < songs.length}
              />;
      case 'search':
        return <SearchPage
              songs={songs}
              onSongPlay={handleSongPlay}
              formatNumber={formatNumber}
              onAddToPlaylist={handleAddToPlaylist}
              onAddToQueue={handleAddToQueue}
              imageUrls={imageUrls}
              setImageUrls={setImageUrls}
            />;
      case 'settings':
        return <SettingsPage onPlaylistsClick={() => setCurrentPage('playlists')} onLikedClick={() => setCurrentPage('liked')} />;
      default:
        return <HomePage
              songs={displayedSongs}
              onSongPlay={handleSongPlay}
              formatNumber={formatNumber}
              onAddToPlaylist={handleAddToPlaylist}
              onAddToQueue={handleAddToQueue}
              imageUrls={imageUrls}
              onLoadMore={loadMoreSongs}
              hasMoreSongs={displayCount < songs.length}
            />;
    }
  };

  const themeClasses = isDarkMode 
    ? 'bg-gray-900 text-white' 
    : 'bg-gray-50 text-gray-900';
const setCurrentTimeState = setCurrentTime;

  return (
    
      <div className={`min-h-screen ${themeClasses} relative overflow-hidden`}>
        {/* Main Content */}
        <div className={`transition-all duration-300 ${currentSong ? 'pb-36' : 'pb-20'}`}>
          {renderContent()}
        </div>

        {/* Bottom Navigation */}
        {currentPage === 'main' && (
          <div className={`fixed bottom-0 left-0 right-0 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t z-30`}>
            <div className="flex items-center justify-around py-3">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center space-y-1 p-2 transition-colors ${
                  activeTab === 'home' ? 'text-purple-400' : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <HomeIcon size={24} />
                <span className="text-xs">Home</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`flex flex-col items-center space-y-1 p-2 transition-colors ${
                  activeTab === 'search' ? 'text-purple-400' : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <Search size={24} />
                <span className="text-xs">Search</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-col items-center space-y-1 p-2 transition-colors ${
                  activeTab === 'settings' ? 'text-purple-400' : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                <Settings size={24} />
                <span className="text-xs">Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* Music Player - Only show if currentSong exists */}
        {currentSong && (
          <>
            {!isPlayerMaximized ? (
              <MinimizedPlayer
                song={currentSong}
                isPlaying={isPlaying}
                imageUrl={imageUrls[currentSong.img_id]}
                onTogglePlay={togglePlay}
                onMaximize={togglePlayerSize}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onClose={closePlayer}
                onToggleLike={() => handleToggleLike(currentSong.id)}
                formatNumber={formatNumber}
                currentTime={currentTime}
                duration={duration}
              />
            ) : (
              <MaximizedPlayer
                song={currentSong}
                isPlaying={isPlaying}
                imageUrl={imageUrls[currentSong.img_id]}
                onTogglePlay={togglePlay}
                onMinimize={togglePlayerSize}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onToggleLike={() => handleToggleLike(currentSong.id)}
                formatNumber={formatNumber}
                onAddToPlaylist={() => handleAddToPlaylist(currentSong)}
                currentTime={currentTime}
                duration={duration}

              setCurrentTime={(seekTime) => {
  if (audioRef.current && !isNaN(audioRef.current.duration)) {
    setIsExternallySeeking(true);
    audioRef.current.currentTime = seekTime;
    setCurrentTimeState(seekTime);
    setTimeout(() => setIsExternallySeeking(false), 200);
  } else {
    setPendingSeekTime(seekTime); // Will apply onLoadedMetadata
  }
}}



                volume={volume}
                setVolume={setVolume}
                isSeeking={isSeeking}
                setIsSeeking={setIsSeeking}
                queue={queue}
                onRemoveFromQueue={removeFromQueue}
                onSongPlay={handleSongPlay}
                imageUrls={imageUrls}
              />
            )}
          </>
        )}

        {/* Modals */}
        <CreatePlaylistModal
          isOpen={showCreatePlaylistModal}
          onClose={() => setShowCreatePlaylistModal(false)}
          onCreatePlaylist={createPlaylist}
        />

        <AddToPlaylistModal
          isOpen={showAddToPlaylistModal}
          onClose={() => {
            setShowAddToPlaylistModal(false);
            setSelectedSongForPlaylist(null);
          }}
          song={selectedSongForPlaylist}
          playlists={playlists}
          onAddToPlaylist={addSongToPlaylist}
          onCreatePlaylist={() => {
            setShowAddToPlaylistModal(false);
            setShowCreatePlaylistModal(true);
          }}
          imageUrls={imageUrls}
          setImageUrls={setImageUrls}
        />
        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onEnded={handleSongEnd}
          onTimeUpdate={() => {
          if (audioRef.current && !isSeeking && !isExternallySeeking) {
            const current = audioRef.current.currentTime;
            // Only update state if the difference is significant
            if (Math.abs(currentTime - current) > 0.25) {
              setCurrentTime(current);
            }
          }
        }}


          onLoadedMetadata={handleLoadedMetadata}
          onVolumeChange={() => {
            if (audioRef.current) {
              setVolume(audioRef.current.volume);
            }
          }}
          style={{ display: 'none' }}
        />

      </div>
  );
}

export default function MusicPlayerApp() {
  return (
    <AuthWrapper>
      <Toaster position="bottom-center" />
      <MusicPlayerContent />
    </AuthWrapper>
  );
}