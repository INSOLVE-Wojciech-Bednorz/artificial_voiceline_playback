import React, { useState } from 'react';

interface ConnectionDiagnostics {
  endpoint: string;
  status: 'success' | 'failed' | 'timeout' | 'not_tested';
  responseTime?: number;
  errorDetails?: string;
  timestamp: Date;
}

interface ConnectionErrorStateProps {
  onRetry: () => void;
  lastError?: string | null;
  lastChecked?: Date | null;
  diagnostics?: ConnectionDiagnostics[];
  retryCount?: number;
  onGetDetailedDiagnostics?: () => Promise<ConnectionDiagnostics[]>;
}

const ConnectionErrorState: React.FC<ConnectionErrorStateProps> = ({ 
  onRetry, 
  lastError, 
  lastChecked, 
  diagnostics = [], 
  retryCount = 0,
  onGetDetailedDiagnostics 
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [detailedDiagnostics, setDetailedDiagnostics] = useState<ConnectionDiagnostics[]>([]);
  
  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDetailedDiagnostics = async () => {
    if (!onGetDetailedDiagnostics) return;
    
    setIsRunningDiagnostics(true);
    try {
      const results = await onGetDetailedDiagnostics();
      setDetailedDiagnostics(results);
      setShowDetailedDiagnostics(true);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'timeout':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
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

                      {lastError && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                          <h4 className="font-medium text-red-800 mb-2">Szczegóły błędu:</h4>
                          <p className="text-sm text-red-700">{lastError}</p>
                          {lastChecked && (
                            <p className="text-xs text-red-600 mt-2">
                              Ostatnia próba: {lastChecked.toLocaleString('pl-PL')}
                            </p>
                          )}
                          {retryCount > 0 && (
                            <p className="text-xs text-red-600 mt-1">
                              Liczba prób połączenia: {retryCount}
                            </p>
                          )}
                        </div>
                      )}

                      {diagnostics.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
                          <h4 className="font-medium text-blue-800 mb-3">Status testowanych endpointów:</h4>
                          <div className="space-y-2">
                            {diagnostics.map((diagnostic, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center space-x-2">
                                  {getStatusIcon(diagnostic.status)}
                                  <code className="bg-blue-100 px-2 py-1 rounded text-xs">{diagnostic.endpoint}</code>
                                </div>
                                <div className="text-right">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    diagnostic.status === 'success' ? 'bg-green-100 text-green-800' :
                                    diagnostic.status === 'timeout' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {diagnostic.status}
                                  </span>
                                  {diagnostic.responseTime && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {diagnostic.responseTime}ms
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2 mt-4">
                        <button 
                          onClick={handleRetry}
                          disabled={isRetrying}
                          className={`flex-1 ${isRetrying ? 'bg-amber-400' : 'bg-amber-600 hover:bg-amber-700'} text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center`}
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

                        {onGetDetailedDiagnostics && (
                          <button 
                            onClick={handleDetailedDiagnostics}
                            disabled={isRunningDiagnostics}
                            className={`px-4 py-2 ${isRunningDiagnostics ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors flex items-center`}
                          >
                            {isRunningDiagnostics ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Diagnostyka...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                                Pełna diagnostyka
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {showDetailedDiagnostics && detailedDiagnostics.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-4">
                          <h4 className="font-medium text-gray-800 mb-3">Szczegółowa diagnostyka endpointów:</h4>
                          <div className="space-y-3">
                            {detailedDiagnostics.map((diagnostic, index) => (
                              <div key={index} className="bg-white p-3 rounded border">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    {getStatusIcon(diagnostic.status)}
                                    <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{diagnostic.endpoint}</code>
                                  </div>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    diagnostic.status === 'success' ? 'bg-green-100 text-green-800' :
                                    diagnostic.status === 'timeout' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {diagnostic.status}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div>Czas odpowiedzi: {diagnostic.responseTime}ms</div>
                                  <div>Timestamp: {diagnostic.timestamp.toLocaleString('pl-PL')}</div>
                                  {diagnostic.errorDetails && (
                                    <div className="text-red-600">Błąd: {diagnostic.errorDetails}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
