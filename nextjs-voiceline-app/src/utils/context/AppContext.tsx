'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../api';
import { useConnectionContext } from './ConnectionContext';

// Define types
export interface VoiceLine {
  id: number;
  text: string;
  active: boolean;
  file_path?: string;
}

export interface RadioStatus {
  is_playing: boolean;
  current_station?: string;
  volume: number;
}

export interface VoiceSystemStatus {
  is_active: boolean;
  interval: number;
  volume: number;
}

export interface SchedulerStatus {
  is_running: boolean;
}

interface AppContextType {
  // Voice Lines
  voiceLines: VoiceLine[];
  voiceLinesLoading: boolean;
  voiceLinesError: string | null;
  refreshVoiceLines: () => Promise<void>;
  
  // Radio Status
  radioStatus: RadioStatus | null;
  radioStatusLoading: boolean;
  radioStatusError: string | null;
  refreshRadioStatus: () => Promise<void>;
  setRadioVolume: (volume: number) => Promise<void>;
  toggleRadio: (isPlaying: boolean) => Promise<void>;
  changeStation: (stationUrl: string) => Promise<void>;
  
  // Voice System Status
  voiceSystemStatus: VoiceSystemStatus | null;
  voiceSystemLoading: boolean;
  voiceSystemError: string | null;
  refreshVoiceSystemStatus: () => Promise<void>;
  setVoiceSystemInterval: (interval: number) => Promise<void>;
  setVoiceSystemVolume: (volume: number) => Promise<void>;
  toggleVoiceSystem: (isActive: boolean) => Promise<void>;
  
  // Scheduler Status
  schedulerActive: boolean;
  schedulerLoading: boolean;
  schedulerError: string | null;
  refreshSchedulerStatus: () => Promise<void>;
  toggleScheduler: () => Promise<void>;
}

// Create the context with a default empty value
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
const AppContextProvider = ({ children }: { children: ReactNode }) => {
  // Access connection context
  const connectionContext = useConnectionContext();
  
  // Voice Lines State
  const [voiceLines, setVoiceLines] = useState<VoiceLine[]>([]);
  const [voiceLinesLoading, setVoiceLinesLoading] = useState(true);
  const [voiceLinesError, setVoiceLinesError] = useState<string | null>(null);
  
  // Radio Status State
  const [radioStatus, setRadioStatus] = useState<RadioStatus | null>(null);
  const [radioStatusLoading, setRadioStatusLoading] = useState(true);
  const [radioStatusError, setRadioStatusError] = useState<string | null>(null);
  
  // Voice System Status State
  const [voiceSystemStatus, setVoiceSystemStatus] = useState<VoiceSystemStatus | null>(null);
  const [voiceSystemLoading, setVoiceSystemLoading] = useState(true);
  const [voiceSystemError, setVoiceSystemError] = useState<string | null>(null);
  
  // Scheduler Status State
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(true);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);

  // Fetch settings (only called when needed)
  const fetchSettings = async () => {
    setRadioStatusLoading(true);
    setVoiceSystemLoading(true);
    
    try {
      const settingsResponse = await api.get('/settings');
      const settings = settingsResponse.data;
      
      // Extract radio status from settings
      if (settings && settings.radio) {
        setRadioStatus({
          is_playing: settings.radio.is_playing,
          current_station: settings.radio.station_url,
          volume: settings.volumes.radio
        });
        setRadioStatusError(null);
      }
      
      // Extract voice system status from settings
      if (settings) {
        setVoiceSystemStatus({
          is_active: settings.scheduler?.is_running || false,
          interval: settings.scheduler?.interval || 60,
          volume: settings.volumes?.voice || 1.0
        });
        setVoiceSystemError(null);
      }
    } catch (error: any) {
      // Check if it's a backend connection error
      if (error.isBackendConnectionError) {
        // Use friendly error message instead of showing technical details
        setRadioStatusError('Brak połączenia z serwerem');
        setVoiceSystemError('Brak połączenia z serwerem');
      } else {
        console.error('Error fetching settings:', error);
        setRadioStatusError(error?.response?.data?.detail || 'Nie udało się załadować ustawień');
        setVoiceSystemError(error?.response?.data?.detail || 'Nie udało się załadować ustawień');
      }
    } finally {
      setRadioStatusLoading(false);
      setVoiceSystemLoading(false);
    }
  };

  // Voice lines fetch function
  const refreshVoiceLines = useCallback(async () => {
    setVoiceLinesLoading(true);
    setVoiceLinesError(null);
    
    try {
      const response = await api.get('/lines');
      setVoiceLines(response.data);
    } catch (error: any) {
      // Check if it's a backend connection error
      if (error.isBackendConnectionError) {
        // Use friendly error message for connection issues
        setVoiceLinesError('Brak połączenia z serwerem');
      } else {
        // For other errors, use response detail or default message
        setVoiceLinesError(error?.response?.data?.detail || 'Nie udało się załadować linii głosowych');
        console.error('Error fetching voice lines:', error);
      }
    } finally {
      setVoiceLinesLoading(false);
    }
  }, []);

  // Radio Status functions
  const refreshRadioStatus = useCallback(async () => {
    // Use useCallback to prevent infinite loops
    await fetchSettings();
  }, []);

  const setRadioVolume = async (volume: number) => {
    try {
      await api.post('/radio/volume', { volume });
      await refreshRadioStatus();
    } catch (error: any) {
      console.error('Error setting radio volume:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to set radio volume');
    }
  };

  const toggleRadio = async (isPlaying: boolean) => {
    try {
      if (isPlaying) {
        await api.post('/radio/play');
      } else {
        await api.post('/radio/stop');
      }
      await refreshRadioStatus();
    } catch (error: any) {
      console.error('Error toggling radio:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to toggle radio');
    }
  };

  const changeStation = async (stationUrl: string) => {
    try {
      await api.post('/radio/station', { station_url: stationUrl });
      await refreshRadioStatus();
    } catch (error: any) {
      console.error('Error changing radio station:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to change radio station');
    }
  };

  // Voice System Status functions
  const refreshVoiceSystemStatus = useCallback(async () => {
    // Use useCallback to prevent infinite loops
    await fetchSettings();
  }, []);

  const setVoiceSystemInterval = async (interval: number) => {
    try {
      await api.post('/voice_system/interval', { interval });
      await refreshVoiceSystemStatus();
    } catch (error: any) {
      console.error('Error setting voice system interval:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to set voice system interval');
    }
  };

  const setVoiceSystemVolume = async (volume: number) => {
    try {
      await api.post('/voice_system/volume', { volume });
      await refreshVoiceSystemStatus();
    } catch (error: any) {
      console.error('Error setting voice system volume:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to set voice system volume');
    }
  };

  const toggleVoiceSystem = async (isActive: boolean) => {
    try {
      if (isActive) {
        await api.post('/voice_system/start');
      } else {
        await api.post('/voice_system/stop');
      }
      await refreshVoiceSystemStatus();
    } catch (error: any) {
      console.error('Error toggling voice system:', error);
      throw new Error(error?.response?.data?.detail || 'Failed to toggle voice system');
    }
  };
  
  // Scheduler Status functions
  const refreshSchedulerStatus = useCallback(async () => {
    setSchedulerLoading(true);
    setSchedulerError(null);
    
    try {
      const response = await api.get('/scheduler/status');
      setSchedulerActive(response.data.is_running);
      setSchedulerError(null);
    } catch (error: any) {
      // Check if it's a backend connection error
      if (error.isBackendConnectionError) {
        // Silently set to default - we already have connection error displayed elsewhere
        setSchedulerActive(false);
        // We don't need to show connection error for every component
        // setSchedulerError('Brak połączenia z serwerem');
      } else {
        console.error('Error fetching scheduler status:', error);
        setSchedulerActive(false);
        setSchedulerError(error?.response?.data?.detail || 'Nie udało się załadować statusu harmonogramu');
      }
    } finally {
      setSchedulerLoading(false);
    }
  }, []);
  
  const toggleScheduler = async () => {
    setSchedulerLoading(true);
    setSchedulerError(null);
    try {
      if (schedulerActive) {
        await api.post('/scheduler/stop');
      } else {
        await api.post('/scheduler/start');
      }
      
      // Refresh scheduler status after toggle
      await refreshSchedulerStatus();
      
      // Also refresh voice lines since they depend on scheduler state
      await refreshVoiceLines();
      
    } catch (error: any) {
      console.error('Error toggling scheduler:', error);
      setTimeout(async () => {
        await refreshSchedulerStatus();
      }, 1000);
    } finally {
      setSchedulerLoading(false);
    }
  };

  // Load initial data on mount and when connection state changes
  useEffect(() => {
    // Only fetch data if connected
    if (connectionContext.isConnected) {
      // Initial fetch of voice lines
      refreshVoiceLines();
      
      // Initial fetch of scheduler status
      refreshSchedulerStatus();
      
      // Initial fetch of settings
      fetchSettings();
      
      // Set up scheduler status refresh every 10 seconds
      const schedulerInterval = setInterval(() => {
        // Only refresh if still connected
        if (connectionContext.isConnected) {
          refreshSchedulerStatus();
        }
      }, 10000); // Refresh every 10 seconds
      
      // Clean up on unmount
      return () => {
        clearInterval(schedulerInterval);
      };
    }
  }, [refreshVoiceLines, refreshSchedulerStatus, connectionContext.isConnected]);

  // Create the context value object with all our state and functions
  const contextValue: AppContextType = {
    // Voice Lines
    voiceLines,
    voiceLinesLoading,
    voiceLinesError,
    refreshVoiceLines,
    
    // Radio Status
    radioStatus,
    radioStatusLoading,
    radioStatusError,
    refreshRadioStatus,
    setRadioVolume,
    toggleRadio,
    changeStation,
    
    // Voice System Status
    voiceSystemStatus,
    voiceSystemLoading,
    voiceSystemError,
    refreshVoiceSystemStatus,
    setVoiceSystemInterval,
    setVoiceSystemVolume,
    toggleVoiceSystem,
    
    // Scheduler Status
    schedulerActive,
    schedulerLoading,
    schedulerError,
    refreshSchedulerStatus,
    toggleScheduler,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Named export for compatibility with page.tsx import
export const AppProvider = AppContextProvider;

// Hook to use the app context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// Export the AppContextProvider as default
export default AppContextProvider;
