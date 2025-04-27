import React, { useState } from 'react';

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
      <label className="inline-block text-sm font-medium mb-2">Volume Settings</label>
      
      <div className="space-y-4">
        {/* Volume Sliders */}
        <div className="grid grid-cols-1 gap-4">
          {/* Master Volume Slider */}
          <div>
            <label htmlFor="master" className="block text-xs font-medium text-gray-700 mb-1">
              Master Volume: {settings.master.toFixed(2)}
            </label>
            <input
              type="range"
              id="master"
              name="master"
              min="0"
              max="2"
              step="0.01"
              value={settings.master}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          {/* Radio Volume Slider */}
          <div>
            <label htmlFor="radio" className="block text-xs font-medium text-gray-700 mb-1">
              Radio Volume: {settings.radio.toFixed(2)}
            </label>
            <input
              type="range"
              id="radio"
              name="radio"
              min="0"
              max="1"
              step="0.01"
              value={settings.radio}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Ducking Volume Slider */}
          <div>
            <label htmlFor="ducking" className="block text-xs font-medium text-gray-700 mb-1">
              Ducking Volume: {settings.ducking.toFixed(2)}
            </label>
            <input
              type="range"
              id="ducking"
              name="ducking"
              min="0"
              max="1"
              step="0.01"
              value={settings.ducking}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Voice Volume Slider */}
          <div>
            <label htmlFor="voice" className="block text-xs font-medium text-gray-700 mb-1">
              Voice Volume: {settings.voice.toFixed(2)}
            </label>
            <input
              type="range"
              id="voice"
              name="voice"
              min="0"
              max="2"
              step="0.01"
              value={settings.voice}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
            <h3 className="text-xs font-medium">Compression Settings</h3>
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
                <label htmlFor="threshold" className="block text-xs font-medium text-gray-700 mb-1">
                  Threshold: {settings.compression.threshold.toFixed(1)} dBFS
                </label>
                <input
                  type="range"
                  id="threshold"
                  name="threshold"
                  min="-60"
                  max="0"
                  step="0.1"
                  value={settings.compression.threshold}
                  onChange={handleCompressionChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-60 dB</span>
                  <span>0 dB</span>
                </div>
              </div>

              {/* Ratio Slider */}
              <div>
                <label htmlFor="ratio" className="block text-xs font-medium text-gray-700 mb-1">
                  Ratio: {settings.compression.ratio.toFixed(1)}:1
                </label>
                <input
                  type="range"
                  id="ratio"
                  name="ratio"
                  min="1"
                  max="20"
                  step="0.1"
                  value={settings.compression.ratio}
                  onChange={handleCompressionChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1:1</span>
                  <span>20:1</span>
                </div>
              </div>

              {/* Attack Slider */}
              <div>
                <label htmlFor="attack" className="block text-xs font-medium text-gray-700 mb-1">
                  Attack: {settings.compression.attack.toFixed(1)} ms
                </label>
                <input
                  type="range"
                  id="attack"
                  name="attack"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={settings.compression.attack}
                  onChange={handleCompressionChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0.1 ms</span>
                  <span>100 ms</span>
                </div>
              </div>

              {/* Release Slider */}
              <div>
                <label htmlFor="release" className="block text-xs font-medium text-gray-700 mb-1">
                  Release: {settings.compression.release.toFixed(1)} ms
                </label>
                <input
                  type="range"
                  id="release"
                  name="release"
                  min="1"
                  max="1000"
                  step="1"
                  value={settings.compression.release}
                  onChange={handleCompressionChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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