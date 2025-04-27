'use client';

import React from 'react';
import { AppProvider } from '../../lib/context/AppContext';
import Header from '../../components/Header';
import SettingsManager from '../../components/Settings/SettingsManager';

export default function Settings() {
  return (
    <AppProvider>
      <Header />
      <main>
        <div className="animated-gradient-bg"></div>
        <div className="content-container px-4 py-6 max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          <SettingsManager />
        </div>
      </main>
    </AppProvider>
  );
}