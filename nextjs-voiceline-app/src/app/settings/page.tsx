'use client';

import React, { useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from '../../utils/context/AppContext';
import Header from '../../components/Header';
import SettingsManager from '../../components/Settings/SettingsManager';

// This component will be used inside the AppProvider
const SettingsContent = () => {
  const { refreshRadioStatus } = useAppContext();
  const initialLoadDone = useRef(false);
  
  // Fetch settings data only once when component mounts
  useEffect(() => {
    if (!initialLoadDone.current) {
      refreshRadioStatus();
      initialLoadDone.current = true;
    }
  }, [refreshRadioStatus]);
  
  return (
    <main className="h-full overflow-auto">
      <div className="animated-gradient-bg"></div>
      <div className="h-full">
        <SettingsManager />
      </div>
    </main>
  );
};

// Main page component
export default function Settings() {
  return (
    <AppProvider>
      <Header />
      <SettingsContent />
    </AppProvider>
  );
}