// errorUtils.ts - Utility functions for error handling

/**
 * Formats API errors for user display
 * @param err The error object from an API call
 * @returns A user-friendly error message
 */
export const formatApiError = (err: any): string => {
  if (!err) return "Wystąpił nieznany błąd";
  
  // Case 1: Backend connection error
  if (err.isBackendConnectionError) {
    return err.friendlyMessage || "Nie można połączyć się z backendem. Upewnij się, że serwer jest uruchomiony.";
  }

  // Case 2: ElevenLabs API error
  if (err.isElevenLabsApiError || 
     (err.response?.data?.detail && err.response.data.detail.includes('ElevenLabs API Error'))) {
    
    // Check for specific ElevenLabs error cases
    const detail = err.response?.data?.detail || "";
    
    if (detail.includes("Invalid API key") || detail.includes("401")) {
      return "Nieprawidłowy klucz API ElevenLabs. Sprawdź konfigurację w ustawieniach.";
    }
    
    if (detail.includes("API Key") || detail.includes("nie jest skonfigurowany")) {
      return "Klucz API ElevenLabs nie jest skonfigurowany. Dodaj poprawny klucz w ustawieniach.";
    }
    
    return detail || "Błąd API ElevenLabs. Sprawdź ustawienia API.";
  }

  // Case 3: Other API response errors with details
  if (err.response?.data?.detail) {
    return err.response.data.detail;
  }

  // Case 4: General axios errors
  if (err.message) {
    return `Błąd: ${err.message}`;
  }

  // Fallback
  return "Wystąpił błąd. Spróbuj ponownie.";
};
