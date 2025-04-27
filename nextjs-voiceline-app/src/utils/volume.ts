import api from './api';

export interface VolumeSettings {
  masterVolume: number;
  radioVolume: number;
  duckingVolume: number;
  voiceVolume: number;
}

// Funkcja do pobierania wszystkich ustawień głośności
export const getVolumeSettings = async (): Promise<VolumeSettings> => {
  try {
    const response = await api.get('/config/volume');
    return response.data;
  } catch (error) {
    console.error('Error fetching volume settings:', error);
    throw error;
  }
};

// Funkcja do ustawiania głównej głośności
export const setMasterVolume = async (volume: number): Promise<void> => {
  try {
    await api.post('/config/volume/master', { volume });
  } catch (error) {
    console.error('Error setting master volume:', error);
    throw error;
  }
};

// Funkcja do ustawiania głośności radia
export const setRadioVolume = async (volume: number): Promise<void> => {
  try {
    await api.post('/radio/volume', { volume });
  } catch (error) {
    console.error('Error setting radio volume:', error);
    throw error;
  }
};

// Funkcja do ustawiania głośności ducking (przyciszanie podczas odtwarzania)
export const setDuckingVolume = async (volume: number): Promise<void> => {
  try {
    await api.post('/config/volume/ducking', { volume });
  } catch (error) {
    console.error('Error setting ducking volume:', error);
    throw error;
  }
};

// Funkcja do ustawiania głośności głosu
export const setVoiceVolume = async (volume: number): Promise<void> => {
  try {
    await api.post('/voice_system/volume', { volume });
  } catch (error) {
    console.error('Error setting voice volume:', error);
    throw error;
  }
};