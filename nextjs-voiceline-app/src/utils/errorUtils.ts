// errorUtils.ts - Utility functions for error handling

interface ApiErrorResponse {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
  isElevenLabsApiError?: boolean;
  isBackendConnectionError?: boolean;
  friendlyMessage?: string;
}

/**
 * Formats API errors for user display
 * @param err The error object from an API call
 * @returns A user-friendly error message
 */
export const formatApiError = (err: unknown): string => {
  if (!err) return "Wystąpił nieznany błąd";
  
  // Case 1: Backend connection error
  if (typeof err === 'object' && err !== null && 'isBackendConnectionError' in err) {
    const connectionErr = err as { isBackendConnectionError: boolean; friendlyMessage?: string };
    return connectionErr.friendlyMessage || "Nie można połączyć się z backendem. Upewnij się, że serwer jest uruchomiony.";
  }

  // Cast to our expected error type for further processing
  const apiErr = err as ApiErrorResponse;

  // Case 2: ElevenLabs API error
  if (apiErr.isElevenLabsApiError || 
     (apiErr.response?.data?.detail && apiErr.response.data.detail.includes('ElevenLabs API Error'))) {
    
    // Check for specific ElevenLabs error cases
    const detail = apiErr.response?.data?.detail || "";
    
    if (detail.includes("Invalid API key") || detail.includes("401")) {
      return "Nieprawidłowy klucz API ElevenLabs. Sprawdź konfigurację w ustawieniach.";
    }
    
    if (detail.includes("API Key") || detail.includes("nie jest skonfigurowany")) {
      return "Klucz API ElevenLabs nie jest skonfigurowany. Dodaj poprawny klucz w ustawieniach.";
    }
    
    return detail || "Błąd API ElevenLabs. Sprawdź ustawienia API.";
  }

  // Case 3: Other API response errors with details
  if (apiErr.response?.data?.detail) {
    return apiErr.response.data.detail;
  }

  // Case 4: General axios errors
  if (apiErr.message) {
    return `Błąd: ${apiErr.message}`;
  }

  // Fallback
  return "Wystąpił błąd. Spróbuj ponownie.";
};
