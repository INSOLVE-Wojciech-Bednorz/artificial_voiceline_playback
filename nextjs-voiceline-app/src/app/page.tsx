'use client';

import React from 'react';
import { AppProvider } from '../lib/context/AppContext';
import Header from '../components/Header';
import VoiceLinesList from '../components/VoiceLinesList';

export default function Home() {
  return (
    <AppProvider>
      <Header />
      <main>
        <div className="animated-gradient-bg"></div>
        <div className="content-container">
          <VoiceLinesList/>
        </div>
      </main>
    </AppProvider>
  );
}
