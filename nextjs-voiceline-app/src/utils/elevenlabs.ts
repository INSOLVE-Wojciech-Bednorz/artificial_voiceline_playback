import api from './api';

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  voiceModel: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

// Funkcja do zapisywania konfiguracji ElevenLabs
export const saveElevenLabsConfig = async (config: Partial<ElevenLabsConfig>) => {
  try {
    await api.post('/config/elevenlabs', config);
    return true;
  } catch (error) {
    console.error('Error saving ElevenLabs config:', error);
    throw error;
  }
};

// Funkcja do pobierania konfiguracji ElevenLabs
export const getElevenLabsConfig = async (): Promise<ElevenLabsConfig> => {
  try {
    const response = await api.get('/config/elevenlabs');
    return response.data;
  } catch (error) {
    console.error('Error fetching ElevenLabs config:', error);
    throw error;
  }
};

// Funkcja do aktualizacji pojedynczego parametru ElevenLabs
export const updateElevenLabsParameter = async (parameter: string, value: any) => {
  try {
    await api.patch('/config/elevenlabs', { [parameter]: value });
    return true;
  } catch (error) {
    console.error(`Error updating ElevenLabs parameter ${parameter}:`, error);
    throw error;
  }
};