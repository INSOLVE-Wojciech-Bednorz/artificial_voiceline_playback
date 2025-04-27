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
    <main>
      <div className="animated-gradient-bg"></div>
      <div className="content-container px-4 py-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
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