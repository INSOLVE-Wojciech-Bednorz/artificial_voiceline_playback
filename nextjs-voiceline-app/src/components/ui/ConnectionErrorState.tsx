import React, { useState } from 'react';

interface ConnectionErrorStateProps {
  onRetry: () => void;
}

const ConnectionErrorState: React.FC<ConnectionErrorStateProps> = ({ onRetry }) => {
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };
  
  return (
    <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Status połączenia
                  </h2>
                  <p className="text-sm text-gray-600">
                    Problem z połączeniem do serwera.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center p-8">
                <div className="text-center p-6 max-w-md">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                    <div className="text-amber-600 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      <h3 className="text-lg font-medium text-amber-800">Brak połączenia z serwerem</h3>
                    </div>
                    <div className="space-y-4">
                      <p className="text-gray-700">
                        Nie można połączyć się z serwerem API. Upewnij się, że serwer jest uruchomiony.
                      </p>
                      
                      <div className="bg-white border border-gray-200 rounded-md p-4">
                        <h4 className="font-medium text-gray-800 mb-2">Możliwe rozwiązania:</h4>
                        <ul className="text-sm text-left text-gray-600 list-disc pl-5 space-y-1">
                          <li>Upewnij się, że serwer backend jest uruchomiony</li>
                          <li>Sprawdź czy dostępny jest pod adresem: <code className="bg-gray-100 px-1 py-0.5 rounded">http://localhost:8060</code></li>
                          <li>Uruchom aplikację backend komendą <code className="bg-gray-100 px-1 py-0.5 rounded">python main.py</code></li>
                        </ul>
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-4">
                        <h4 className="font-medium text-gray-800 mb-2">Co może być przyczyną:</h4>
                        <ul className="text-sm text-left text-gray-600 list-disc pl-5 space-y-1">
                          <li>Serwer backend nie został uruchomiony</li>
                          <li>Serwer został zatrzymany lub uległ awarii</li>
                          <li>Jest problem z połączeniem sieciowym</li>
                          <li>Adres API jest niepoprawny lub uległ zmianie</li>
                        </ul>
                      </div>
                      
                      <button 
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className={`w-full ${isRetrying ? 'bg-amber-400' : 'bg-amber-600 hover:bg-amber-700'} text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center`}
                      >
                        {isRetrying ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Łączenie...
                          </>
                        ) : (
                          <>Spróbuj ponownie</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectionErrorState;
