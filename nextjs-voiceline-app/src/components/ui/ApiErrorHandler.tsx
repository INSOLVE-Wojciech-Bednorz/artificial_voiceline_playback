import React from 'react';
import Link from 'next/link';

interface ApiErrorHandlerProps {
  error: string;
  onDismiss?: () => void;
}

const ApiErrorHandler: React.FC<ApiErrorHandlerProps> = ({ error, onDismiss }) => {
  // Detect if this is an ElevenLabs API key error
  const isElevenLabsKeyError = error && (
    error.includes('ElevenLabs API Error') || 
    error.includes('Invalid API key') || 
    error.includes('API Key') || 
    error.includes('Elevenlabs')
  );

  return (
    <div className="p-4 bg-red-50 border border-red-300 rounded-lg mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="font-medium text-red-800">Błąd API</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error}</p>
            
            {isElevenLabsKeyError && (
              <div className="mt-3">
                <p className="font-medium">Wymagana konfiguracja:</p>
                <p className="mt-1">Wygląda na to, że klucz API ElevenLabs nie jest poprawnie skonfigurowany.</p>
                <Link 
                  href="/settings" 
                  className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Przejdź do ustawień
                  <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              type="button"
              className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Zamknij</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiErrorHandler;
