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

console.log('Łączenie z API pod adresem:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Dodanie interceptora do obsługi błędów połączenia
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.message === 'Network Error') {
      console.error('Nie można połączyć się z API pod adresem:', API_BASE_URL);
    }
    return Promise.reject(error);
  }
);

export default api;