import axios from 'axios';

// Funkcja do określenia odpowiedniego adresu API w zależności od środowiska
function determineApiBaseUrl() {
  // Jeśli zdefiniowano zmienną środowiskową, użyj jej
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // W przeciwnym razie spróbuj automatycznie wykryć środowisko
  // W przeglądarce window.location.hostname daje bieżący host
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  
  // Jeśli hostname nie jest localhost, użyj go jako adresu API
  // W przeciwnym razie użyj localhost
  return hostname === 'localhost' ? 'http://localhost:8060/' : `http://${hostname}:8060/`;
}

const API_BASE_URL = determineApiBaseUrl();

// Wyciszam logi produkcyjne
// console.log('Łączenie z API pod adresem:', API_BASE_URL);

let backendUnavailableLogged = false;

const api = axios.create({
  baseURL: API_BASE_URL,
  // Shorter timeout to avoid long waits when backend is down
  timeout: 10000,
});

// Dodanie interceptora do obsługi błędów połączenia
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network and timeout errors
    if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
      // Limit console error messages - log only once
      if (!backendUnavailableLogged) {
        console.info('Backend niedostępny pod adresem:', API_BASE_URL);
        backendUnavailableLogged = true;
        
        // Reset flag after 1 minute to allow another log entry
        setTimeout(() => {
          backendUnavailableLogged = false;
        }, 60000);
      }
      
      // Transform the error to make it more friendly
      error.isBackendConnectionError = true;
      error.friendlyMessage = 'Nie można połączyć się z backendem. Upewnij się, że serwer jest uruchomiony.';
    }
    
    // Handle ElevenLabs API errors (503 responses from our backend)
    if (error.response && error.response.status === 503 && 
        error.response.data && 
        (error.response.data.detail || '').includes('ElevenLabs API Error')) {
      error.isElevenLabsApiError = true;
      // Enhance the error object with a friendly message about API key configuration
      if ((error.response.data.detail || '').includes('Invalid API key')) {
        error.friendlyMessage = 'Nieprawidłowy klucz API ElevenLabs. Sprawdź konfigurację w ustawieniach.';
      }
    }
    return Promise.reject(error);
  }
);

export default api;