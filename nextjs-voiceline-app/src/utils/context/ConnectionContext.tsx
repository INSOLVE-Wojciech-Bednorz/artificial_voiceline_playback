'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

// Define types
interface ConnectionDiagnostics {
  endpoint: string;
  status: 'success' | 'failed' | 'timeout' | 'not_tested';
  responseTime?: number;
  errorDetails?: string;
  timestamp: Date;
}

interface ConnectionContextType {
  isConnected: boolean;
  isChecking: boolean;
  lastError: string | null;
  lastChecked: Date | null;
  diagnostics: ConnectionDiagnostics[];
  retryCount: number;
  retryConnection: () => Promise<boolean>;
  getDetailedDiagnostics: () => Promise<ConnectionDiagnostics[]>;
}

// Create the context
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Provider component
export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true); // Start with assumption of connection
  const [isChecking, setIsChecking] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  
  // Function to test specific endpoint
  const testEndpoint = async (endpoint: string, timeout: number = 3000): Promise<ConnectionDiagnostics> => {
    const startTime = Date.now();
    const timestamp = new Date();
    
    try {
      await api.get(endpoint, { timeout });
      const responseTime = Date.now() - startTime;
      return {
        endpoint,
        status: 'success',
        responseTime,
        timestamp
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorDetails = 'Unknown error';
      
      if (error instanceof Error) {
        errorDetails = error.message;
      }
      
      const status = responseTime >= timeout ? 'timeout' : 'failed';
      
      return {
        endpoint,
        status,
        responseTime,
        errorDetails,
        timestamp
      };
    }
  };

  // Function to get detailed diagnostics
  const getDetailedDiagnostics = async (): Promise<ConnectionDiagnostics[]> => {
    const endpoints = [
      '/',
      '/scheduler/status',
      '/lines',
      '/settings',
      '/health'
    ];
    
    const results: ConnectionDiagnostics[] = [];
    
    for (const endpoint of endpoints) {
      const result = await testEndpoint(endpoint, 5000);
      results.push(result);
    }
    
    setDiagnostics(results);
    return results;
  };
  
  // Function to check connection to API
  const checkConnection = async (): Promise<boolean> => {
    setLastChecked(new Date());
    setRetryCount(prev => prev + 1);
    
    const currentDiagnostics: ConnectionDiagnostics[] = [];
    
    try {
      // Try the root endpoint first which acts as a health check
      const rootResult = await testEndpoint('/', 3000);
      currentDiagnostics.push(rootResult);
      
      if (rootResult.status === 'success') {
        setIsConnected(true);
        setLastError(null);
        setDiagnostics(currentDiagnostics);
        return true;
      }
      
      // If that fails, try the scheduler/status endpoint
      const schedulerResult = await testEndpoint('/scheduler/status', 3000);
      currentDiagnostics.push(schedulerResult);
      
      if (schedulerResult.status === 'success') {
        setIsConnected(true);
        setLastError(null);
        setDiagnostics(currentDiagnostics);
        return true;
      }
      
      // If both fail, try a lines endpoint as final fallback
      const linesResult = await testEndpoint('/lines', 3000);
      currentDiagnostics.push(linesResult);
      
      if (linesResult.status === 'success') {
        setIsConnected(true);
        setLastError(null);
        setDiagnostics(currentDiagnostics);
        return true;
      }
      
      // All endpoints failed - use the first error as the main error
      const mainError = currentDiagnostics[0];
      let errorMessage = 'Wszystkie endpointy API są nieosiągalne';
      
      if (mainError && mainError.errorDetails) {
        if (mainError.errorDetails.includes('ECONNREFUSED')) {
          errorMessage = 'Odmowa połączenia - serwer prawdopodobnie nie jest uruchomiony (ECONNREFUSED)';
        } else if (mainError.errorDetails.includes('ENOTFOUND')) {
          errorMessage = 'Nie można znaleźć serwera - błędny adres (ENOTFOUND)';
        } else if (mainError.errorDetails.includes('ETIMEDOUT') || mainError.errorDetails.includes('timeout')) {
          errorMessage = 'Timeout połączenia - serwer nie odpowiada w wyznaczonym czasie';
        } else if (mainError.errorDetails.includes('ECONNRESET')) {
          errorMessage = 'Połączenie zostało przerwane przez serwer (ECONNRESET)';
        } else if (mainError.errorDetails.includes('EHOSTUNREACH')) {
          errorMessage = 'Host nieosiągalny - problem z siecią (EHOSTUNREACH)';
        } else if (mainError.errorDetails.includes('ENETUNREACH')) {
          errorMessage = 'Sieć nieosiągalna (ENETUNREACH)';
        } else {
          errorMessage = `Błąd połączenia: ${mainError.errorDetails}`;
        }
      }
      
      console.log('Backend connection check failed:', errorMessage);
      setLastError(errorMessage);
      setIsConnected(false);
      setDiagnostics(currentDiagnostics);
      return false;
      
    } catch (error) {
      let errorMessage = 'Nieznany błąd podczas sprawdzania połączenia';
      
      if (error instanceof Error) {
        errorMessage = `Błąd: ${error.message}`;
      }
      
      console.log('Backend connection check failed:', errorMessage);
      setLastError(errorMessage);
      setIsConnected(false);
      setDiagnostics(currentDiagnostics);
      return false;
    } finally {
      setIsChecking(false);
    }
  };
  
  // Function to retry connection
  const retryConnection = async (): Promise<boolean> => {
    setIsChecking(true);
    return await checkConnection();
  };
  
  // Check connection on mount
  useEffect(() => {
    // Initial check
    checkConnection();
    
    // On initial load, check more frequently for the first minute
    let quickCheckInterval: NodeJS.Timeout | null = setInterval(() => {
      if (!isConnected) {
        checkConnection();
      }
    }, 5000); // Check every 5 seconds initially if not connected
    
    // After 1 minute, switch to normal interval
    const timeoutId = setTimeout(() => {
      if (quickCheckInterval) {
        clearInterval(quickCheckInterval);
        quickCheckInterval = null;
      }
    }, 60000);
    
    // Set up regular check interval
    const regularInterval = setInterval(() => {
      checkConnection();
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(regularInterval);
      if (quickCheckInterval) clearInterval(quickCheckInterval);
      clearTimeout(timeoutId);
    };
  }, [isConnected]); // checkConnection is not stable, so we use isConnected as dependency
  
  // Create the context value
  const contextValue: ConnectionContextType = {
    isConnected,
    isChecking,
    lastError,
    lastChecked,
    diagnostics,
    retryCount,
    retryConnection,
    getDetailedDiagnostics
  };
  
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
};

// Hook to use the connection context
export const useConnectionContext = () => {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnectionContext must be used within a ConnectionProvider');
  }
  return context;
};

export default ConnectionProvider;