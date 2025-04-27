import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../utils/api';
import VoiceSettings from './VoiceSettings';
import VolumeSettings from './VolumeSettings';
import SchedulerSettings from './SchedulerSettings';
import Scheduler from '../Scheduler';

// Define custom event type for unsaved changes
interface CheckUnsavedChangesEvent {
  callback: (canProceed: boolean) => void;
  targetPath: string;
}

// Define types based on the Python models
interface CompressionSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

interface VoiceSettingsType {
  id: string;
  model: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

interface VolumeSettingsType {
  master: number;
  radio: number;
  ducking: number;
  voice: number;
  compression: CompressionSettings;
}

interface RadioSettingsType {
  station_url: string; // Zmieniono wartość pole zgodnie z backendem
  is_playing: boolean; // Dodano pole zgodnie z backendem
}

interface SchedulerSettingsType {
  interval: number;
}

interface DistortionSettings {
  enabled: boolean;
  sample_rate: number;
  distortion: number;
  filter_low: number;
  filter_high: number;
  noise_level: number;
  bit_depth: number;
  crackle: number;
}

export interface AppSettings {
  api_key: string;
  voice: VoiceSettingsType;
  volumes: VolumeSettingsType;
  radio: RadioSettingsType;
  scheduler: SchedulerSettingsType; // Dodano zgodnie z backendem
  distortion_simulation: DistortionSettings;
}

const SettingsManager = () => {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // Zamiast używać mapy z tablicami callbacków, przechowujmy tylko jeden aktywny callback
  const pendingCallback = React.useRef<((canProceed: boolean) => void) | null>(null);

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/settings');
        setSettings(response.data);
        setOriginalSettings(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching settings:', err);
        setError(err.response?.data?.detail || 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Check for unsaved changes whenever settings are updated
  useEffect(() => {
    if (settings && originalSettings) {
      const settingsStr = JSON.stringify(settings);
      const originalSettingsStr = JSON.stringify(originalSettings);
      setHasChanges(settingsStr !== originalSettingsStr);
    }
  }, [settings, originalSettings]);

  // Handle "beforeunload" event to prevent accidental window/tab close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        // Standard way to show confirmation dialog on page close/refresh
        e.preventDefault();
        e.returnValue = ''; // This string is not actually shown to the user in modern browsers
        return ''; // This message will not be shown in modern browsers
      }
    };

    if (hasChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  // Create a router intercept to catch navigation events within the app
  useEffect(() => {
    // For older Next.js versions compatibility
    const handleRouteChangeStart = (url: string) => {
      if (hasChanges && url !== window.location.pathname) {
        // Store pending navigation to resume later if user confirms
        setPendingNavigation(url);
        // Open confirmation dialog
        setIsModalOpen(true);
        // Next.js will continue navigation unless we cancel it
        return false;
      }
    };

    // Try to intercept navigation attempts
    // This is the Next.js way to detect page navigation
    if (typeof (router as any).events?.on === 'function') {
      (router as any).events.on('routeChangeStart', handleRouteChangeStart);

      return () => {
        if (typeof (router as any).events?.off === 'function') {
          (router as any).events.off('routeChangeStart', handleRouteChangeStart);
        }
      };
    }

    return () => {};
  }, [router, hasChanges]);

  // Listen for unsaved changes check event
  useEffect(() => {
    const handleCheckUnsavedChanges = (e: CustomEvent<CheckUnsavedChangesEvent>) => {
      const { callback, targetPath } = e.detail;
      
      if (hasChanges) {
        // Save target path for navigation after confirmation
        setPendingNavigation(targetPath);
        
        // Store the callback for this navigation path 
        pendingCallback.current = callback;
        
        // Show confirmation modal
        setIsModalOpen(true);
      } else {
        // No changes, we can proceed with navigation
        callback(true);
      }
    };

    // Add event listener
    window.addEventListener('check_unsaved_changes', handleCheckUnsavedChanges as EventListener);
    
    // Remove event listener on component unmount
    return () => {
      window.removeEventListener('check_unsaved_changes', handleCheckUnsavedChanges as EventListener);
    };
  }, [hasChanges]);

  // Handle settings changes
  const handleSettingsChange = (section: keyof AppSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: value
    });
  };

  // Handle nested settings changes (for volumes, voice, radio)
  const handleNestedSettingsChange = (
    section: keyof AppSettings, 
    field: string, 
    value: any
  ) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value
      }
    });
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!settings) return;
    
    try {
      setIsSaving(true);
      setSaveMessage(null);
      
      // Create a diff object with only changed settings
      const changedSettings: Partial<AppSettings> = {};
      
      // Compare original settings with current settings to build the update payload
      if (settings.api_key !== originalSettings?.api_key) {
        changedSettings.api_key = settings.api_key;
      }
      
      // Add voice settings if changed
      if (JSON.stringify(settings.voice) !== JSON.stringify(originalSettings?.voice)) {
        changedSettings.voice = settings.voice;
      }
      
      // Add volumes settings if changed
      if (JSON.stringify(settings.volumes) !== JSON.stringify(originalSettings?.volumes)) {
        changedSettings.volumes = settings.volumes;
      }
      
      // Add radio settings if changed
      if (JSON.stringify(settings.radio) !== JSON.stringify(originalSettings?.radio)) {
        changedSettings.radio = settings.radio;
      }
      
      // Add scheduler settings if changed
      if (JSON.stringify(settings.scheduler) !== JSON.stringify(originalSettings?.scheduler)) {
        changedSettings.scheduler = settings.scheduler;
      }
      
      // Skip distortion_simulation as per requirements
      
      // Send update if there are changes
      if (Object.keys(changedSettings).length > 0) {
        const response = await api.put('/settings', changedSettings);
        setSettings(response.data);
        setOriginalSettings(response.data);
        setHasChanges(false);
        setSaveMessage({
          type: 'success',
          text: 'Settings saved successfully!'
        });
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setSaveMessage(null);
        }, 3000);
      } else {
        setSaveMessage({
          type: 'success',
          text: 'No changes to save'
        });
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setSaveMessage(null);
        }, 3000);
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setSaveMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to save settings'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset settings to original values
  const handleCancelChanges = useCallback(() => {
    if (originalSettings) {
      setSettings({...originalSettings});
      setHasChanges(false);
      setSaveMessage(null);
    }
    setIsModalOpen(false);
    
    // If there was a pending navigation, proceed with it
    if (pendingNavigation) {
      const navigateUrl = pendingNavigation;
      setPendingNavigation(null);
      // Use setTimeout to allow React state updates to complete
      setTimeout(() => {
        router.push(navigateUrl);
      }, 0);
    }
  }, [originalSettings, pendingNavigation, router]);

  // Attempt to navigate away, show modal if changes exist
  const handleAttemptNavigateAway = (url: string) => {
    if (hasChanges) {
      setPendingNavigation(url);
      setIsModalOpen(true);
      return false;
    } else {
      // No unsaved changes, proceed with navigation
      router.push(url);
      return true;
    }
  };

  // Handle close modal and discard changes
  const handleCloseModalAndDiscard = () => {
    // Store current pending navigation before resetting state
    const currentPendingNavigation = pendingNavigation;
    
    // Reset settings to original values
    if (originalSettings) {
      setSettings({...originalSettings});
      setHasChanges(false);
      setSaveMessage(null);
    }
    
    // Close the modal
    setIsModalOpen(false);
    
    // If there was a pending navigation, proceed with it
    if (currentPendingNavigation) {
      // Extract the callback from the event that triggered the navigation
      const callback = pendingCallback.current;
      
      // Clear this pending navigation
      setPendingNavigation(null);
      
      // If we have a callback, call it to signal that navigation can proceed
      if (callback) {
        callback(true);
        pendingCallback.current = null;
      } else {
        // Otherwise, use direct navigation
        setTimeout(() => {
          router.push(currentPendingNavigation);
        }, 0);
      }
    }
  };

  // Handle keeping changes and continuing editing
  const handleKeepChanges = () => {
    // Get the current navigation that was requested
    const currentPendingNavigation = pendingNavigation;
    
    // Clear the pending navigation
    setPendingNavigation(null);
    
    // Close the modal
    setIsModalOpen(false);
    
    // If there was a callback for this navigation, call it with false to prevent navigation
    if (currentPendingNavigation) {
      const callback = pendingCallback.current;
      if (callback) {
        callback(false);
        pendingCallback.current = null;
      }
    }
  };

  // Handle user-initiated navigation (e.g. from menu clicks)
  const handleNavigation = (url: string) => {
    return handleAttemptNavigateAway(url);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <>
      {/* Card Section */}
      <div className="max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
        {/* Scheduler Control Card */}
        <div className="bg-white rounded-xl shadow-xs p-4 sm:p-7 mb-8">
          <Scheduler />
        </div>

        {/* Settings Card */}
        <div className="bg-white rounded-xl shadow-xs p-4 sm:p-7">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
              Settings
            </h2>
            <p className="text-sm text-gray-600">
              Configure your voice system settings.
            </p>
          </div>

          <form>
            {/* API Key Section */}
            <div className="py-6 first:pt-0 last:pb-0 border-t first:border-transparent border-gray-200">
              <label htmlFor="api_key" className="inline-block text-sm font-medium">
                ElevenLabs API Key
              </label>

              <div className="mt-2">
                <input
                  type="password"
                  id="api_key"
                  value={settings.api_key}
                  onChange={(e) => handleSettingsChange('api_key', e.target.value)}
                  className="py-1.5 sm:py-2 px-3 pe-11 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            {/* End API Key Section */}

            {/* Voice Settings Section */}
            <div className="py-6 first:pt-0 last:pb-0 border-t first:border-transparent border-gray-200">
              <VoiceSettings 
                settings={settings.voice}
                onChange={(field, value) => handleNestedSettingsChange('voice', field, value)}
              />
            </div>
            {/* End Voice Settings Section */}

            {/* Volume Settings Section */}
            <div className="py-6 first:pt-0 last:pb-0 border-t first:border-transparent border-gray-200">
              <VolumeSettings 
                settings={settings.volumes}
                onChange={(field, value) => handleNestedSettingsChange('volumes', field, value)}
              />
            </div>
            {/* End Volume Settings Section */}
            
            {/* Scheduler Settings Section */}
            <div className="py-6 first:pt-0 last:pb-0 border-t first:border-transparent border-gray-200">
              <SchedulerSettings 
                settings={settings.scheduler}
                onChange={(field, value) => handleNestedSettingsChange('scheduler', field, value)}
              />
            </div>
            {/* End Scheduler Settings Section */}
          </form>

          {/* Action Buttons - Only show when there are changes */}
          {hasChanges && (
            <div className="mt-5 flex justify-end gap-x-2">
              <button
                onClick={handleCancelChanges}
                className="py-1.5 sm:py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="py-1.5 sm:py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-blue-700"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          )}

          {/* Save Message */}
          {saveMessage && (
            <div className={`mt-4 p-4 rounded-md ${
              saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {saveMessage.text}
            </div>
          )}
        </div>
        {/* End Settings Card */}
      </div>
      {/* End Card Section */}

      {/* Confirmation Modal */}
      <div
        id="unsaved-changes-alert"
        className={`fixed inset-0 z-50 overflow-x-hidden overflow-y-auto flex items-center justify-center ${isModalOpen ? 'block bg-gray-900/80' : 'hidden'}`}
        role="dialog"
        tabIndex={-1}
        aria-labelledby="unsaved-changes-alert-label"
      >
        <div className={`transform transition-all duration-300 ${isModalOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12'} sm:max-w-lg sm:w-full m-3 sm:mx-auto`}>
          <div className="relative flex flex-col bg-white shadow-lg rounded-xl">
            <div className="absolute top-2 end-2">
              <button
                type="button"
                className="size-8 inline-flex justify-center items-center gap-x-2 rounded-full border border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-200"
                aria-label="Close"
                onClick={handleKeepChanges}
              >
                <span className="sr-only">Close</span>
                <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div className="p-4 sm:p-10 text-center overflow-y-auto">
              {/* Icon */}
              <span className="mb-4 inline-flex justify-center items-center size-16 rounded-full border-4 border-yellow-50 bg-yellow-100 text-yellow-500">
                <svg className="shrink-0 size-6" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                </svg>
              </span>
              {/* End Icon */}

              <h3 id="unsaved-changes-alert-label" className="mb-2 text-2xl font-bold text-gray-800">
                Unsaved Changes
              </h3>
              <p className="text-gray-500">
                You have unsaved changes. Are you sure you want to discard these changes?
              </p>

              <div className="mt-6 flex justify-center gap-x-4">
                <button
                  type="button"
                  className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-2xs hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
                  onClick={handleCloseModalAndDiscard}
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-blue-700"
                  onClick={handleKeepChanges}
                >
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* End Confirmation Modal */}
    </>
  );
};

export default SettingsManager;