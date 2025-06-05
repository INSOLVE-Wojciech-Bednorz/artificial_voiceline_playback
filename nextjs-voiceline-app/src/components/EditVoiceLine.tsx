import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import ApiErrorHandler from './ui/ApiErrorHandler';
import { formatApiError } from '../utils/errorUtils';
import ConfirmationModal from './ui/ConfirmationModal';
import Portal from './ui/Portal';

interface EditVoiceLineProps {
  lineId: number;
  currentText: string;
  isActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onVoiceLineUpdated: () => void;
}

const EditVoiceLine: React.FC<EditVoiceLineProps> = ({ 
  lineId,
  currentText,
  isActive,
  isOpen,
  onClose,
  onVoiceLineUpdated 
}) => {
  console.log('EditVoiceLine rendered with props:', { lineId, currentText, isActive, isOpen });
  
  const [text, setText] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7); // Default volume 70%
  const [previousVolume, setPreviousVolume] = useState(0.7); // For mute/unmute
  const [isMuted, setIsMuted] = useState(false);
  
  const needsRefreshRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Set initial text and active state when component opens
  useEffect(() => {
    if (isOpen) {
      setText(currentText);
      setActive(isActive);
      setError(null);
      needsRefreshRef.current = false;
    }
  }, [isOpen, currentText, isActive]);

  // Cleanup audio when component unmounts or modal closes
  useEffect(() => {
    return () => {
      console.log('Audio cleanup triggered');
      if (audioRef.current) {
        console.log('Pausing and cleaning up audio');
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, []); // Remove audioUrl dependency - only cleanup on unmount

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      console.log('Modal closed, stopping audio');
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  const handleCloseModal = () => {
    // If we toggled active state, refresh the list when closing
    if (needsRefreshRef.current && onVoiceLineUpdated) {
      onVoiceLineUpdated();
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError("Tekst nie może być pusty");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.put(`/lines/${lineId}`, { new_text: text });
      
      // Always refresh on submit
      if (onVoiceLineUpdated) {
        onVoiceLineUpdated();
      }
      
      handleCloseModal();
    } catch (err: any) {
      console.error('Błąd podczas aktualizacji linii głosowej:', err);
      // Use centralized error formatting
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling active state
  const handleToggleActive = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default form submission
    e.stopPropagation(); // Stop event propagation
    
    setToggleLoading(true);
    setError(null);
    
    const newActiveState = !active;
    
    try {
      // Call API to toggle line active status
      await api.post('/lines/toggle', {
        ids: [lineId],
        state: newActiveState
      });
      
      // Update local state immediately
      setActive(newActiveState);
      
      // Mark that we need to refresh when closing the modal
      needsRefreshRef.current = true;
      
    } catch (err: any) {
      console.error('Błąd podczas zmiany statusu linii głosowej:', err);
      // Use centralized error formatting
      setError(formatApiError(err));
    } finally {
      setToggleLoading(false);
    }
  };

  // Initiate delete process
  const initiateDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirmation(true);
  };

  // Handle delete confirmation
  const handleDelete = async () => {
    setDeleteLoading(true);
    setError(null);
    
    try {
      await api.post('/lines/remove', {
        ids: [lineId]
      });
      
      // Close confirmation modal
      setShowDeleteConfirmation(false);
      
      // Close edit modal
      handleCloseModal();
      
      // Refresh the list
      if (onVoiceLineUpdated) {
        onVoiceLineUpdated();
      }
    } catch (err: any) {
      console.error('Błąd podczas usuwania linii głosowej:', err);
      setError(formatApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle audio playback
  const handlePlayAudio = async () => {
    console.log('handlePlayAudio called for lineId:', lineId);
    setPlayLoading(true);
    setError(null);
    
    try {
      console.log('Fetching audio file from:', `/lines/${lineId}/audiofile`);
      const response = await api.get(`/lines/${lineId}/audiofile`, {
        responseType: 'blob'
      });
      
      console.log('Audio response received, size:', response.data.size);
      
      // Clean up previous audio if exists
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Create audio URL from blob
      const newAudioUrl = URL.createObjectURL(response.data);
      setAudioUrl(newAudioUrl);
      console.log('Created audio URL:', newAudioUrl);
      
      const audio = new Audio(newAudioUrl);
      audioRef.current = audio;
      
      // Set initial volume
      audio.volume = volume;
      
      // Set up audio event listeners
      audio.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded, duration:', audio.duration);
        setDuration(audio.duration);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        setCurrentTime(0);
      });
      
      audio.addEventListener('play', () => {
        console.log('Audio started playing');
        setIsPlaying(true);
      });
      
      audio.addEventListener('pause', () => {
        console.log('Audio paused - current time:', audio.currentTime, 'paused:', audio.paused);
        setIsPlaying(false);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        setIsPlaying(false);
        setError('Błąd podczas ładowania pliku audio');
      });
      
      // Wait for audio to be ready before playing
      await new Promise((resolve) => {
        if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
          resolve(void 0);
        } else {
          audio.addEventListener('canplay', () => resolve(void 0), { once: true });
        }
      });
      
      // Try to play audio with proper error handling
      try {
        console.log('Attempting to play audio, readyState:', audio.readyState);
        const playPromise = audio.play();
        console.log('Play promise created');
        await playPromise;
        console.log('Audio play() succeeded');
      } catch (playError: any) {
        console.error('Play error:', playError);
        // Handle specific play errors
        if (playError.name === 'NotAllowedError') {
          setError('Odtwarzanie audio wymaga interakcji użytkownika. Kliknij ponownie aby odtworzyć.');
        } else if (playError.name === 'AbortError') {
          // This is expected when switching between audio files quickly - don't show error to user
          console.log('Play request was aborted (this is normal when switching audio)');
          setIsPlaying(false); // Ensure UI state is consistent
        } else {
          console.error('Play error:', playError);
          setError('Nie udało się odtworzyć pliku audio: ' + playError.message);
        }
      }
      
    } catch (err: any) {
      console.error('Błąd podczas odtwarzania audio:', err);
      setError(formatApiError(err));
    } finally {
      setPlayLoading(false);
    }
  };

  // Handle play/pause toggle
  const handlePlayPause = async () => {
    console.log('handlePlayPause called - isPlaying:', isPlaying, 'audioRef.current:', !!audioRef.current, 'playLoading:', playLoading);
    
    // If audio is not loaded, load it first
    if (!audioRef.current) {
      console.log('No audio loaded, calling handlePlayAudio');
      await handlePlayAudio();
      return;
    }
    
    // If audio is already loading, don't do anything
    if (playLoading) {
      console.log('Already loading, skipping');
      return;
    }
    
    try {
      if (isPlaying) {
        console.log('Pausing audio');
        audioRef.current.pause();
      } else {
        console.log('Playing audio');
        // Clear any previous errors before attempting to play
        setError(null);
        await audioRef.current.play();
      }
    } catch (error: any) {
      console.error('Error in handlePlayPause:', error);
      if (error.name === 'NotAllowedError') {
        setError('Odtwarzanie audio wymaga interakcji użytkownika. Spróbuj ponownie.');
      } else if (error.name === 'AbortError') {
        // This is expected when switching between audio quickly - don't show error
        console.log('Play request was aborted (this is normal when switching audio)');
      } else {
        console.error('Play/pause error:', error);
        setError('Błąd podczas odtwarzania: ' + error.message);
      }
    }
  };

  // Handle stop
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Format time for display
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.volume = previousVolume;
      }
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      {/* Enhanced backdrop with higher z-index */}
      <div className="fixed inset-0 bg-gray-900/75 transition-opacity backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4">
        <div 
          className="fixed inset-0" 
          onClick={handleCloseModal}
        ></div>
        
        {/* Modal container with improved responsive design */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh] flex flex-col border border-gray-200 animate-slideIn overflow-hidden mx-auto">
          {/* Minimalist Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17S7.79 21 10 21 14 19.21 14 17V7H18V3H12Z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edycja linii głosowej</h2>
                <p className="text-sm text-gray-500">ID: #{lineId}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {active ? (
                <span className="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-semibold bg-gradient-to-r from-emerald-500/90 to-green-500/90 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/20">
                  <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                  </svg>
                  <span className="relative">
                    Aktywna
                  </span>
                </span>
              ) : (
                <span className="py-2 px-3 inline-flex items-center gap-x-2 text-xs font-semibold bg-gradient-to-r from-red-500/90 to-pink-500/90 text-white rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-white/20">
                  <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                  </svg>
                  Nieaktywna
                </span>
              )}
              
              <button 
                onClick={handleCloseModal}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
                type="button"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* Audio Player Section */}
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3V13.55C11.41 13.21 10.73 13 10 13C7.79 13 6 14.79 6 17S7.79 21 10 21 14 19.21 14 17V7H18V3H12Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Audio Player</h3>
                  <p className="text-sm text-gray-500">Odsłuchaj aktualną linię głosową</p>
                </div>
                {audioRef.current && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    Audio gotowe
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm audio-controls">
                {/* Audio Controls Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {/* Play/Pause and Stop buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        console.log('Play button clicked!');
                        handlePlayPause();
                      }}
                      disabled={playLoading || loading}
                      className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                      title={isPlaying ? "Wstrzymaj" : "Odtwórz"}
                    >
                      {playLoading ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5,3 19,12 5,21"></polygon>
                        </svg>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleStop}
                      disabled={!audioRef.current || playLoading || loading}
                      className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:transform-none"
                      title="Zatrzymaj"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="4" width="16" height="16"></rect>
                      </svg>
                    </button>
                  </div>

                  {/* Seek bar and time */}
                  <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 min-w-0">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-sm font-semibold text-gray-700 min-w-[50px] text-center">
                        {formatTime(currentTime)}
                      </span>
                      <div className="flex-1 sm:min-w-[200px] relative">
                        <input
                          type="range"
                          min="0"
                          max={duration || 0}
                          value={currentTime}
                          onChange={handleSeek}
                          disabled={!audioRef.current}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #e5e7eb ${(currentTime / (duration || 1)) * 100}%, #e5e7eb 100%)`
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 min-w-[50px] text-center">
                        {formatTime(duration)}
                      </span>
                    </div>
                  </div>

                  {/* Volume Controls */}
                  <div className="flex items-center justify-center sm:justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleMuteToggle}
                      disabled={!audioRef.current}
                      className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 disabled:opacity-40 transform hover:scale-105"
                      title={isMuted ? "Włącz dźwięk" : "Wycisz"}
                    >
                      {isMuted ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3.63 3.63C3.24 4.02 3.24 4.65 3.63 5.04L7.29 8.7L7 9H4C3.45 9 3 9.45 3 10V14C3 14.55 3.45 15 4 15H7L10.29 18.29C10.92 18.92 12 18.47 12 17.58V13.41L16.18 17.59C15.69 17.96 15.16 18.27 14.58 18.5C14.22 18.65 14 19.03 14 19.42C14 20.14 14.73 20.6 15.39 20.33C16.19 20 16.94 19.56 17.61 19.02L18.95 20.36C19.34 20.75 19.97 20.75 20.36 20.36C20.75 19.97 20.75 19.34 20.36 18.95L5.05 3.64C4.66 3.25 4.03 3.25 3.64 3.64L3.63 3.63ZM19 12C19 12.82 18.85 13.61 18.59 14.34L20.12 15.87C20.68 14.7 21 13.39 21 12C21 8.17 18.6 4.89 15.22 3.6C14.63 3.37 14 3.83 14 4.46V4.65C14 5.03 14.25 5.36 14.61 5.5C17.18 6.54 19 9.06 19 12ZM10.29 5.71L10.15 5.85C9.9 6.1 9.9 6.5 10.15 6.75L11.41 8.01C11.82 7.5 12 6.79 12 6.07V4.42C12 3.53 10.92 3.08 10.29 5.71Z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9V15H7L12 20V4L7 9H3ZM16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12Z"/>
                        </svg>
                      )}
                    </button>
                    
                    <div className="w-20 sm:w-20">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        disabled={!audioRef.current}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
                        }}
                      />
                    </div>
                    
                    <span className="text-sm font-semibold text-gray-600 min-w-[35px] text-center">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>

                {/* Status indicator */}
                {isPlaying && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl py-3 border border-blue-200">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-5 bg-blue-500 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-1.5 h-4 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="font-semibold">Odtwarzanie w toku</span>
                  </div>
                )}
              </div>
            </div>

            {/* Text Editor Section */}
            <div className="px-6 py-6 flex-1 flex flex-col overflow-auto">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Tekst linii głosowej</h3>
                  <p className="text-sm text-gray-500">Edytuj zawartość tekstową dla generowania audio</p>
                </div>
              </div>
              
              <div className="flex-1 relative min-h-[300px]">
                <textarea
                  id="voiceLineText"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full h-full border-2 border-gray-200 rounded-xl p-6 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-base leading-relaxed transition-all duration-200 placeholder-gray-400 shadow-sm hover:shadow-md hover:border-gray-300"
                  placeholder="Wprowadź tekst dla linii głosowej...&#10;&#10;💡 Wskazówka: Możesz używać znaków interpunkcyjnych aby kontrolować intonację i pauzy w generowanym audio."
                  disabled={loading}
                  style={{minHeight: '280px'}}
                ></textarea>
                
                {/* Character count */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                  {text.length} znaków
                </div>
              </div>
            </div>
            
            {error && (
              <div className="px-6 pb-4">
                <ApiErrorHandler 
                  error={error} 
                  onDismiss={() => setError(null)} 
                />
              </div>
            )}
            
            {/* Footer with improved responsive buttons */}
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Left side - Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={toggleLoading}
                    className={`flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl min-w-[140px] ${
                      active 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' 
                        : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white'
                    } ${toggleLoading ? 'opacity-70 cursor-not-allowed transform-none' : ''}`}
                  >
                    {toggleLoading ? (
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        {active ? (
                          <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
                        ) : (
                          <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z"/>
                        )}
                      </svg>
                    )}
                    {active ? 'Dezaktywuj' : 'Aktywuj'}
                  </button>

                  <button
                    type="button"
                    onClick={initiateDelete}
                    disabled={toggleLoading || loading}
                    className="flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed transform hover:scale-105 min-w-[120px]"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Usuń
                  </button>
                </div>
                
                {/* Right side - Save/Cancel buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:ml-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg min-w-[100px]"
                    disabled={loading}
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-300 disabled:to-indigo-300 font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none min-w-[140px]"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Zapisywanie...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Zapisz zmiany
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Usuń linię głosową"
        message={`Czy na pewno chcesz usunąć linię głosową #${lineId}? Tej operacji nie można cofnąć.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        isLoading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirmation(false)}
        variant="danger"
      />
    </Portal>
  );
};

export default EditVoiceLine;