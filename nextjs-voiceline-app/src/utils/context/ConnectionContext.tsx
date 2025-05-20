'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';

// Define types
interface ConnectionContextType {
  isConnected: boolean;
  isChecking: boolean;
  retryConnection: () => Promise<boolean>;
}

// Create the context
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Provider component
export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true); // Start with assumption of connection
  const [isChecking, setIsChecking] = useState(true);
  
  // Function to check connection to API
  const checkConnection = async (): Promise<boolean> => {
    try {
      // Try the root endpoint first which acts as a health check
      try {
        await api.get('/', { timeout: 3000 });
        setIsConnected(true);
        return true;
      } catch (rootError) {
        // If that fails, try the scheduler/status endpoint
        try {
          await api.get('/scheduler/status', { timeout: 3000 });
          setIsConnected(true);
          return true;
        } catch (schedulerError) {
          // If both fail, try a lines endpoint as final fallback
          await api.get('/lines', { timeout: 3000 });
          setIsConnected(true);
          return true;
        }
      }
    } catch (error) {
      console.log('Backend connection check failed');
      setIsConnected(false);
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
  }, [isConnected]);
  
  // Create the context value
  const contextValue: ConnectionContextType = {
    isConnected,
    isChecking,
    retryConnection
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