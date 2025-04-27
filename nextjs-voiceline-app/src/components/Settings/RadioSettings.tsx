import React, { useState } from 'react';

interface RadioSettingsProps {
  settings: {
    playlist: string | null;
    interval: number;
  };
  onChange: (field: string, value: any) => void;
}

const RadioSettings: React.FC<RadioSettingsProps> = ({ settings, onChange }) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'playlist') {
      onChange(name, value);
    } else if (name === 'interval') {
      onChange(name, parseFloat(value));
    }
  };

  return (
    <>
      <label className="inline-block text-sm font-medium mb-2">Radio Settings</label>
      
      <div className="space-y-4">
        {/* Playlist File */}
        <div>
          <label htmlFor="playlist" className="block text-xs font-medium text-gray-700 mb-1">
            Playlist File
          </label>
          <input
            type="text"
            id="playlist"
            name="playlist"
            value={settings.playlist || ''}
            onChange={handleInputChange}
            placeholder="e.g., RMF_FM.pls"
            className="py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Path to the M3U or PLS playlist file. Leave blank if not using a radio stream.</p>
        </div>

        {/* Interval with tooltip */}
        <div>
          <div className="flex items-center mb-1">
            <label htmlFor="interval" className="block text-xs font-medium text-gray-700">
              Interval (seconds)
            </label>
            <div className="relative ml-2">
              <button
                type="button"
                className="text-gray-400 hover:text-blue-500 focus:outline-none"
                onMouseEnter={() => setTooltipVisible(true)}
                onMouseLeave={() => setTooltipVisible(false)}
                aria-label="Information about interval"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                {tooltipVisible && (
                  <div className="absolute z-10 w-64 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-sm left-6 -top-2 transform -translate-y-full">
                    <p>Częstotliwość linii głosowych - czas pomiędzy odtwarzaniem kolejnych linii głosowych (w sekundach).</p>
                  </div>
                )}
              </button>
            </div>
          </div>
          <input
            type="number"
            id="interval"
            name="interval"
            min="1"
            step="1"
            value={settings.interval}
            onChange={handleInputChange}
            className="py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Zalecane: 30-300 sekund</p>
        </div>
      </div>
    </>
  );
};

export default RadioSettings;