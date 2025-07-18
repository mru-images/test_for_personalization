import { useState, useCallback, useRef } from 'react';
import { Song } from '@/types';

export interface PlaylistItem {
  id: string;
  song: Song;
  addedAt: Date;
  source: 'last_played' | 'personalized' | 'user_selected';
}

export function useDynamicPlaylist() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const getPersonalizedSongsRef = useRef<((userId: string, currentSong: Song) => Promise<Song[]>) | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Initialize playlist with last played song
  const initializePlaylist = useCallback((lastPlayedSong: Song | null, getPersonalizedSongs: (userId: string, currentSong: Song) => Promise<Song[]>, userId: string) => {
    getPersonalizedSongsRef.current = getPersonalizedSongs;
    userIdRef.current = userId;
    
    if (lastPlayedSong && !isInitialized) {
      const initialItem: PlaylistItem = {
        id: `${lastPlayedSong.id}-${Date.now()}`,
        song: lastPlayedSong,
        addedAt: new Date(),
        source: 'last_played'
      };
      
      setPlaylist([initialItem]);
      setCurrentIndex(0);
      setIsInitialized(true);
      
      // Add initial personalized songs
      loadPersonalizedSongs(lastPlayedSong, userId, getPersonalizedSongs);
    }
  }, [isInitialized]);

  // Load personalized songs based on a reference song
  const loadPersonalizedSongs = useCallback(async (referenceSong: Song, userId: string, getPersonalizedSongs: (userId: string, currentSong: Song) => Promise<Song[]>) => {
    try {
      const personalizedSongs = await getPersonalizedSongs(userId, referenceSong);
      
      // Filter out already played songs
      const newSongs = personalizedSongs.filter(song => 
        !playedSongs.has(song.id)
      );
      
      const newItems: PlaylistItem[] = newSongs.map(song => ({
        id: `${song.id}-${Date.now()}-${Math.random()}`,
        song,
        addedAt: new Date(),
        source: 'personalized' as const
      }));
      
      setPlaylist(prev => [...prev, ...newItems]);
    } catch (error) {
      console.error('Error loading personalized songs:', error);
    }
  }, [playedSongs]);

  // Get current song
  const getCurrentSong = useCallback((): Song | null => {
    if (playlist.length === 0 || currentIndex >= playlist.length) return null;
    return playlist[currentIndex].song;
  }, [playlist, currentIndex]);

  // Move to next song
  const moveToNext = useCallback(async (): Promise<Song | null> => {
    if (playlist.length === 0) return null;
    
    const currentSong = getCurrentSong();
    if (currentSong) {
      setPlayedSongs(prev => new Set(prev).add(currentSong.id));
    }
    
    const nextIndex = currentIndex + 1;
    
    // If we're at the second-to-last song, load more personalized songs
    if (nextIndex >= playlist.length - 1 && playlist.length > 0) {
      const lastSong = playlist[playlist.length - 1].song;
      if (getPersonalizedSongsRef.current && userIdRef.current) {
        await loadPersonalizedSongs(lastSong, userIdRef.current, getPersonalizedSongsRef.current);
      }
    }
    
    if (nextIndex < playlist.length) {
      setCurrentIndex(nextIndex);
      return playlist[nextIndex].song;
    }
    
    return null;
  }, [playlist, currentIndex, getCurrentSong, loadPersonalizedSongs]);

  // Move to previous song
  const moveToPrevious = useCallback((): Song | null => {
    if (playlist.length === 0) return null;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    setCurrentIndex(prevIndex);
    return playlist[prevIndex].song;
  }, [playlist, currentIndex]);

  // Add user-selected song and clear future songs
  const addUserSelectedSong = useCallback(async (song: Song) => {
    const currentSong = getCurrentSong();
    if (currentSong) {
      setPlayedSongs(prev => new Set(prev).add(currentSong.id));
    }
    
    // Create new playlist starting from the selected song
    const newItem: PlaylistItem = {
      id: `${song.id}-${Date.now()}`,
      song,
      addedAt: new Date(),
      source: 'user_selected'
    };
    
    setPlaylist([newItem]);
    setCurrentIndex(0);
    
    // Load personalized songs based on the selected song
    if (getPersonalizedSongsRef.current && userIdRef.current) {
      await loadPersonalizedSongs(song, userIdRef.current, getPersonalizedSongsRef.current);
    }
    
    return song;
  }, [getCurrentSong, loadPersonalizedSongs]);

  // Get upcoming songs (for queue display)
  const getUpcomingSongs = useCallback((): Song[] => {
    return playlist.slice(currentIndex + 1).map(item => item.song);
  }, [playlist, currentIndex]);

  // Reset playlist
  const resetPlaylist = useCallback(() => {
    setPlaylist([]);
    setCurrentIndex(0);
    setPlayedSongs(new Set());
    setIsInitialized(false);
  }, []);

  return {
    playlist,
    currentIndex,
    playedSongs,
    isInitialized,
    initializePlaylist,
    getCurrentSong,
    moveToNext,
    moveToPrevious,
    addUserSelectedSong,
    getUpcomingSongs,
    resetPlaylist,
    hasNext: currentIndex < playlist.length - 1,
    hasPrevious: currentIndex > 0
  };
}