import React, { useState } from 'react';
import InfoTooltip from '../ui/InfoTooltip';
import SettingsSlider from './SettingsSlider';

interface CompressionSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}

interface VolumeSettingsProps {
  settings: {
    master: number;
    radio: number;
    ducking: number;
    voice: number;
    compression: CompressionSettings;
  };
  onChange: (field: string, value: any) => void;
}

const VolumeSettings: React.FC<VolumeSettingsProps> = ({ settings, onChange }) => {
  const [isCompressionExpanded, setIsCompressionExpanded] = useState(false);

  // Handle slider changes
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange(name, parseFloat(value));
  };

  // Handle compression settings changes
  const handleCompressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);
    
    // Update the nested compression object
    onChange('compression', {
      ...settings.compression,
      [name]: parsedValue
    });
  };

  return (
    <>
      <label className="inline-block text-sm font-medium mb-2 flex items-center">
        Volume Settings
        <span className="ml-2">
          <InfoTooltip 
            content="Ustawienia głośności pozwalają na dostosowanie poziomów dźwięku dla różnych elementów systemu: głośności głównej, radia, przyciszenia i głosu." 
          />
        </span>
      </label>
      
      <div className="space-y-4">
        {/* Volume Sliders */}
        <div className="grid grid-cols-1 gap-4">
          {/* Master Volume Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="master" className="block text-xs font-medium text-gray-700">
                Master Volume: {settings.master.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Główna głośność systemu - kontroluje ogólny poziom dźwięku wszystkich elementów. Zalecana wartość: 0.5-1.5" 
                  position="right"
                />
              </span>
            </div>
            <SettingsSlider
              id="master"
              name="master"
              min={0}
              max={2}
              step={0.01}
              value={settings.master}
              onChange={handleSliderChange}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          {/* Radio Volume Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="radio" className="block text-xs font-medium text-gray-700">
                Radio Volume: {settings.radio.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Głośność strumienia radiowego. Wartość 1.0 oznacza pełną głośność, 0.0 całkowite wyciszenie." 
                  position="right"
                />
              </span>
            </div>
            <SettingsSlider
              id="radio"
              name="radio"
              min={0}
              max={1}
              step={0.01}
              value={settings.radio}
              onChange={handleSliderChange}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Ducking Volume Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="ducking" className="block text-xs font-medium text-gray-700">
                Ducking Volume: {settings.ducking.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Poziom przyciszenia radia podczas odtwarzania głosu. Niższa wartość oznacza większe przyciszenie radia podczas mówienia." 
                  position="right"
                />
              </span>
            </div>
            <SettingsSlider
              id="ducking"
              name="ducking"
              min={0}
              max={1}
              step={0.01}
              value={settings.ducking}
              onChange={handleSliderChange}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Voice Volume Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="voice" className="block text-xs font-medium text-gray-700">
                Voice Volume: {settings.voice.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Głośność odtwarzanych linii głosowych. Reguluje poziom głośności syntetycznego głosu." 
                  position="right"
                />
              </span>
            </div>
            <SettingsSlider
              id="voice"
              name="voice"
              min={0}
              max={2}
              step={0.01}
              value={settings.voice}
              onChange={handleSliderChange}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>2</span>
            </div>
          </div>
        </div>

        {/* Compression Settings */}
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium flex items-center">
              Compression Settings
              <span className="ml-2">
                <InfoTooltip 
                  content="Ustawienia kompresora dźwięku poprawiające dynamikę głosu i jego słyszalność na tle radia. Zaawansowane ustawienia dla lepszej jakości dźwięku." 
                  position="bottom"
                />
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCompressionExpanded(!isCompressionExpanded)}
              className="text-blue-600 hover:text-blue-800 text-sm focus:outline-none"
            >
              {isCompressionExpanded ? 'Hide' : 'Show'} Details
            </button>
          </div>

          {isCompressionExpanded && (
            <div className="mt-3 space-y-4 bg-gray-50 p-4 rounded-md">
              {/* Threshold Slider */}
              <div>
                <div className="flex items-center mb-1">
                  <label htmlFor="threshold" className="block text-xs font-medium text-gray-700">
                    Threshold: {settings.compression.threshold.toFixed(1)} dBFS
                  </label>
                  <span className="ml-2">
                    <InfoTooltip 
                      content="Próg kompresji - poziom głośności, powyżej którego zostanie zastosowana kompresja. Niższa wartość oznacza więcej kompresji." 
                      position="right"
                    />
                  </span>
                </div>
                <SettingsSlider
                  id="threshold"
                  name="threshold"
                  min={-60}
                  max={0}
                  step={0.1}
                  value={settings.compression.threshold}
                  onChange={handleCompressionChange}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-60 dB</span>
                  <span>0 dB</span>
                </div>
              </div>

              {/* Ratio Slider */}
              <div>
                <div className="flex items-center mb-1">
                  <label htmlFor="ratio" className="block text-xs font-medium text-gray-700">
                    Ratio: {settings.compression.ratio.toFixed(1)}:1
                  </label>
                  <span className="ml-2">
                    <InfoTooltip 
                      content="Stosunek kompresji - określa jak mocno dźwięk powyżej progu zostanie ściszony. Np. 4:1 oznacza, że dźwięk 4dB powyżej progu zostanie zredukowany do 1dB powyżej progu." 
                      position="right"
                    />
                  </span>
                </div>
                <SettingsSlider
                  id="ratio"
                  name="ratio"
                  min={1.1}
                  max={20}
                  step={0.1}
                  value={settings.compression.ratio}
                  onChange={handleCompressionChange}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1.1:1</span>
                  <span>20:1</span>
                </div>
              </div>

              {/* Attack Slider */}
              <div>
                <div className="flex items-center mb-1">
                  <label htmlFor="attack" className="block text-xs font-medium text-gray-700">
                    Attack: {settings.compression.attack.toFixed(1)} ms
                  </label>
                  <span className="ml-2">
                    <InfoTooltip 
                      content="Czas ataku - określa jak szybko kompresor reaguje na wzrost głośności. Niższe wartości oznaczają szybszą reakcję kompresora." 
                      position="right"
                    />
                  </span>
                </div>
                <SettingsSlider
                  id="attack"
                  name="attack"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={settings.compression.attack}
                  onChange={handleCompressionChange}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.1 ms</span>
                  <span>100 ms</span>
                </div>
              </div>

              {/* Release Slider */}
              <div>
                <div className="flex items-center mb-1">
                  <label htmlFor="release" className="block text-xs font-medium text-gray-700">
                    Release: {settings.compression.release.toFixed(1)} ms
                  </label>
                  <span className="ml-2">
                    <InfoTooltip 
                      content="Czas zwolnienia - określa jak szybko kompresor przestaje działać po spadku głośności poniżej progu. Wyższe wartości dają płynniejsze brzmienie." 
                      position="right"
                    />
                  </span>
                </div>
                <SettingsSlider
                  id="release"
                  name="release"
                  min={1}
                  max={1000}
                  step={1}
                  value={settings.compression.release}
                  onChange={handleCompressionChange}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 ms</span>
                  <span>1000 ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default VolumeSettings;