'use client';

import React, { useEffect } from 'react';
import { AppProvider, useAppContext } from '../utils/context/AppContext';
import Header from '../components/Header';
import VoiceLinesList from '../components/VoiceLinesList';

// This component will be wrapped by the AppProvider
const HomeContent = () => {
  const { refreshVoiceLines, refreshSchedulerStatus } = useAppContext();
  
  // Fetch voice lines and scheduler status when the page loads
  useEffect(() => {
    refreshVoiceLines();
    refreshSchedulerStatus();
  }, [refreshVoiceLines, refreshSchedulerStatus]);

  return (
    <main>
      <div className="animated-gradient-bg"></div>
      <div className="content-container">
        <VoiceLinesList/>
      </div>
    </main>
  );
};

export default function Home() {
  return (
    <AppProvider>
      <Header />
      <HomeContent />
    </AppProvider>
  );
}
