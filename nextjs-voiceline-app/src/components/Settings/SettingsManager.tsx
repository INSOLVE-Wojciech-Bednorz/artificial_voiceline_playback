import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../utils/api';
import { useConnectionContext } from '../../utils/context/ConnectionContext';
import VoiceSettings from './VoiceSettings';
import VolumeSettings from './VolumeSettings';
import SchedulerSettings from './SchedulerSettings';
import Scheduler from '../Scheduler';
import ConnectionErrorState from '../ui/ConnectionErrorState';
import { Tab } from '@headlessui/react';
import {
  AdjustmentsHorizontalIcon,
  SpeakerWaveIcon,
  MicrophoneIcon,
  CalendarDaysIcon,
  KeyIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

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
  interval?: number; // Dodano dla zgodności z API
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
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Access connection status
  const { isConnected, isChecking, retryConnection } = useConnectionContext();
  
  // Zamiast używać mapy z tablicami callbacków, przechowujmy tylko jeden aktywny callback
  const pendingCallback = React.useRef<((canProceed: boolean) => void) | null>(null);

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/settings');
        
        // Transform API data to match our frontend structure
        // Create scheduler section with interval from radio section
        const transformedData = {
          ...response.data,
          scheduler: {
            interval: response.data.radio?.interval || 60
          }
        };
        
        setSettings(transformedData);
        setOriginalSettings(transformedData);
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
        ...(settings[section] as Record<string, any>),
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
      
      // Add the interval setting to the radio section instead of a separate scheduler section
      if (settings.scheduler?.interval !== originalSettings?.scheduler?.interval) {
        if (!changedSettings.radio) {
          changedSettings.radio = { ...settings.radio };
        }
        changedSettings.radio.interval = settings.scheduler.interval;
      }
      
      // Skip distortion_simulation as per requirements
      
      // Send update if there are changes
      if (Object.keys(changedSettings).length > 0) {
        const response = await api.put('/settings', changedSettings);
        
        // Transform the response to include scheduler data
        const transformedResponse = {
          ...response.data,
          scheduler: {
            interval: response.data.radio?.interval || 60
          }
        };
        
        setSettings(transformedResponse);
        setOriginalSettings(transformedResponse);
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
      <div className="flex h-full w-full justify-center items-center">
        <div className="flex flex-col items-center bg-white/60 backdrop-blur-sm p-8 rounded-xl shadow-sm">
          <ArrowPathIcon className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="mt-4 text-gray-600 font-medium">Ładowanie ustawień...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full justify-center items-center">
        <div className="bg-red-50/90 backdrop-blur-sm border border-red-200/80 rounded-lg p-6 max-w-md shadow-sm">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-2" />
            <h3 className="font-semibold text-red-700">Błąd</h3>
          </div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Show backend connection error state
  if (!isConnected && !isChecking) {
    return (
      <div className="h-full flex flex-col">
        <ConnectionErrorState 
          onRetry={async () => {
            const connected = await retryConnection();
            if (connected) {
              // Retry loading settings
              setIsLoading(true);
              try {
                const response = await api.get('/settings');
                const transformedData = {
                  ...response.data,
                  scheduler: {
                    interval: response.data.radio?.interval || 60
                  }
                };
                setSettings(transformedData);
                setOriginalSettings(transformedData);
                setError(null);
              } catch (err: any) {
                console.error('Error fetching settings:', err);
                setError(err.response?.data?.detail || 'Failed to load settings');
              } finally {
                setIsLoading(false);
              }
            }
          }}
        />
      </div>
    );
  }
  
  // Show loading state
  if (isLoading || !settings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie ustawień...</p>
        </div>
      </div>
    );
  }
  
  // Show other error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md p-6 bg-red-50 rounded-lg border border-red-200">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-medium text-red-800 mt-3">Błąd ładowania ustawień</h3>
          <p className="text-gray-700 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Odśwież stronę
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col settings-manager-container">
      {/* Fixed position notification banner that doesn't push content down */}
      {hasChanges && (
        <div className="fixed top-16 inset-x-0 z-40 pointer-events-none flex justify-center">
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-lg border border-blue-100/80 pointer-events-auto px-4 py-3 max-w-xl w-full mx-4 flex items-center justify-between settings-appear">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-3"></div>
              <p className="font-medium text-blue-700">Masz niezapisane zmiany</p>
            </div>
            <div className="flex gap-x-2">                <button
                  onClick={handleCancelChanges}
                  className="py-1.5 px-3 text-sm font-medium rounded-lg border border-gray-200/70 bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-gray-50/90 transition-all shadow-sm"
                  disabled={isSaving}
                >
                  <div className="flex items-center space-x-1">
                    <XMarkIcon className="h-4 w-4" />
                    <span>Anuluj</span>
                  </div>
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="py-1.5 px-3 text-sm font-medium rounded-lg border border-transparent bg-blue-600/90 text-white hover:bg-blue-700 transition-all shadow-sm"
                  disabled={isSaving}
                >
                <div className="flex items-center space-x-1">
                  {isSaving ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  <span>{isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings layout with improved design */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left sidebar with improved styling - only visible on desktop */}
        <div className="hidden lg:w-72 lg:flex lg:flex-col lg:bg-white/80 lg:backdrop-blur-sm lg:border-r lg:border-gray-200/70 lg:shadow-sm">
          <div className="p-6">
            <h1 className="text-2xl font-semibold text-gray-900">Ustawienia</h1>
            <p className="text-sm text-gray-500 mt-1">Zarządzaj ustawieniami systemu</p>
          </div>

          {/* Tab navigation with improved visuals - only for desktop */}
          <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab} vertical>
            <Tab.List className="flex flex-col space-y-1 px-4 pb-6">
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`
                      ${selected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'}
                      group flex items-center w-full px-3 py-3 text-sm font-medium transition-all
                    `}
                  >
                    <CalendarDaysIcon className={`h-5 w-5 mr-3 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                    Harmonogram
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`
                      ${selected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'}
                      group flex items-center w-full px-3 py-3 text-sm font-medium transition-all
                    `}
                  >
                    <KeyIcon className={`h-5 w-5 mr-3 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                    API Key
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`
                      ${selected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'}
                      group flex items-center w-full px-3 py-3 text-sm font-medium transition-all
                    `}
                  >
                    <MicrophoneIcon className={`h-5 w-5 mr-3 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                    Głos
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`
                      ${selected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'}
                      group flex items-center w-full px-3 py-3 text-sm font-medium transition-all
                    `}
                  >
                    <SpeakerWaveIcon className={`h-5 w-5 mr-3 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                    Głośność
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={`
                      ${selected ? 'bg-blue-50 text-blue-700 border-l-4 border-l-blue-600' : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'}
                      group flex items-center w-full px-3 py-3 text-sm font-medium transition-all
                    `}
                  >
                    <AdjustmentsHorizontalIcon className={`h-5 w-5 mr-3 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                    Radio
                  </button>
                )}
              </Tab>
            </Tab.List>
          </Tab.Group>

          {/* Save button in sidebar with improved design */}
          <div className="mt-auto p-5 border-t border-gray-200/70 hidden lg:block">
            <button
              onClick={handleSaveSettings}
              className={`w-full py-2.5 px-4 flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                hasChanges 
                  ? 'bg-blue-600/90 text-white hover:bg-blue-700 shadow-sm backdrop-blur-sm' 
                  : 'bg-gray-100/80 text-gray-700 hover:bg-gray-200/90 backdrop-blur-sm'
              }`}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  <span>Zapisywanie...</span>
                </>
              ) : (
                <>
                  <CheckIcon className="h-5 w-5" />
                  <span>Zapisz ustawienia</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right content area with improved panel design */}
        <div className="flex-1 overflow-hidden bg-transparent">
          <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
            {/* Mobile tab navigation with improved styling */}
            <div className="lg:hidden bg-white/90 backdrop-blur-sm border-b border-gray-200/70 shadow-sm">
              <div className="px-4 pt-4">
                <h1 className="text-xl font-semibold text-gray-900">Ustawienia</h1>
                <p className="text-xs text-gray-500 mb-2">Zarządzaj ustawieniami systemu</p>
              </div>
              <div className="px-4 py-2 overflow-x-auto scrollbar-slim">
                <Tab.List className="flex space-x-2">
                  <Tab as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`
                          ${selected ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'}
                          px-3 py-2.5 text-sm font-medium flex items-center space-x-1.5 whitespace-nowrap transition-all
                        `}
                      >
                        <CalendarDaysIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>Harmonogram</span>
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`
                          ${selected ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'}
                          px-3 py-2.5 text-sm font-medium flex items-center space-x-1.5 whitespace-nowrap transition-all
                        `}
                      >
                        <KeyIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>API Key</span>
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`
                          ${selected ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'}
                          px-3 py-2.5 text-sm font-medium flex items-center space-x-1.5 whitespace-nowrap transition-all
                        `}
                      >
                        <MicrophoneIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>Głos</span>
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`
                          ${selected ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'}
                          px-3 py-2.5 text-sm font-medium flex items-center space-x-1.5 whitespace-nowrap transition-all
                        `}
                      >
                        <SpeakerWaveIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>Głośność</span>
                      </button>
                    )}
                  </Tab>
                  <Tab as={Fragment}>
                    {({ selected }) => (
                      <button
                        className={`
                          ${selected ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'}
                          px-3 py-2.5 text-sm font-medium flex items-center space-x-1.5 whitespace-nowrap transition-all
                        `}
                      >
                        <AdjustmentsHorizontalIcon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
                        <span>Radio</span>
                      </button>
                    )}
                  </Tab>
                </Tab.List>
              </div>
            </div>

            {/* Tab content panels with improved design */}
            <Tab.Panels className="flex-1 h-full overflow-auto">
              {/* Scheduler Panel */}
              <Tab.Panel className="h-full overflow-y-auto">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-100/70">
                      <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <CalendarDaysIcon className="h-5 w-5 mr-2 text-blue-600" />
                        Harmonogram
                      </h2>
                      <Scheduler />
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* API Key Panel with improved design */}
              <Tab.Panel className="h-full overflow-y-auto">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-100/70">
                      <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <KeyIcon className="h-5 w-5 mr-2 text-blue-600" />
                        ElevenLabs API Key
                      </h2>
                      <div className="space-y-2">
                        <label htmlFor="api_key" className="block text-sm font-medium text-gray-700">
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            id="api_key"
                            value={settings.api_key}
                            onChange={(e) => handleSettingsChange('api_key', e.target.value)}
                            className="py-2.5 px-3 block w-full border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            placeholder="Wprowadź klucz API ElevenLabs"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            <KeyIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Klucz API jest wymagany do korzystania z usług głosowych ElevenLabs.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Voice Settings Panel */}
              <Tab.Panel className="h-full overflow-y-auto">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-100/70">
                      <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <MicrophoneIcon className="h-5 w-5 mr-2 text-blue-600" />
                        Ustawienia głosu
                      </h2>
                      <VoiceSettings 
                        settings={settings.voice}
                        onChange={(field, value) => handleNestedSettingsChange('voice', field, value)}
                      />
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Volume Settings Panel */}
              <Tab.Panel className="h-full overflow-y-auto">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-100/70">
                      <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <SpeakerWaveIcon className="h-5 w-5 mr-2 text-blue-600" />
                        Ustawienia głośności
                      </h2>
                      <VolumeSettings 
                        settings={settings.volumes}
                        onChange={(field, value) => handleNestedSettingsChange('volumes', field, value)}
                      />
                    </div>
                  </div>
                </div>
              </Tab.Panel>

              {/* Radio Settings Panel */}
              <Tab.Panel className="h-full overflow-y-auto">
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm p-6 border border-gray-100/70">
                      <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                        <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2 text-blue-600" />
                        Ustawienia radia
                      </h2>
                      <SchedulerSettings 
                        settings={settings.scheduler}
                        onChange={(field, value) => handleNestedSettingsChange('scheduler', field, value)}
                      />
                    </div>
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </div>

      {/* Bottom save bar on mobile with improved design */}
      <div className="lg:hidden bg-white/90 backdrop-blur-sm border-t border-gray-200/70 p-4 shadow-lg">
        <button
          onClick={handleSaveSettings}
          className={`w-full py-3 px-4 flex justify-center items-center gap-x-2 text-sm font-medium rounded-lg transition-all ${
            hasChanges 
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              <span>Zapisywanie...</span>
            </>
          ) : (
            <>
              <CheckIcon className="h-5 w-5" />
              <span>Zapisz ustawienia</span>
            </>
          )}
        </button>
      </div>

      {/* Save Message Toast with improved design */}
      {saveMessage && (
        <div 
          className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg max-w-sm settings-appear
            ${saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}
          `}
        >
          <div className="flex items-center">
            {saveMessage.type === 'success' ? (
              <CheckIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
            )}
            <p className={saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {saveMessage.text}
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal with improved design */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4 text-center z-[9999]">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-900/75 transition-opacity backdrop-blur-sm" aria-hidden="true"></div>
            
            {/* Modal panel */}
            <div className="relative bg-white rounded-lg max-w-md w-full p-6 text-left shadow-xl settings-appear">
              <div className="text-center">
                {/* Warning icon */}
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 mb-2" id="modal-title">
                  Niezapisane zmiany
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Masz niezapisane zmiany. Czy na pewno chcesz je odrzucić?
                </p>
                
                <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center items-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                    onClick={handleKeepChanges}
                  >
                    Kontynuuj edycję
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                    onClick={handleCloseModalAndDiscard}
                  >
                    Odrzuć zmiany
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsManager;