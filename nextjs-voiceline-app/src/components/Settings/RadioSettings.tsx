import React from 'react';
import InfoTooltip from '../ui/InfoTooltip';

interface RadioSettingsProps {
  settings: {
    playlist: string | null;
    interval: number;
  };
  onChange: (field: string, value: any) => void;
}

const RadioSettings: React.FC<RadioSettingsProps> = ({ settings, onChange }) => {
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
      <label className="inline-block text-sm font-medium mb-2 flex items-center">
        Radio Settings
        <span className="ml-2">
          <InfoTooltip 
            content="Ustawienia dotyczące radia i częstotliwości odtwarzania linii głosowych. Pozwala na kontrolę strumienia radiowego oraz interwału odtwarzania."
          />
        </span>
      </label>
      
      <div className="space-y-4">
        {/* Playlist File */}
        <div>
          <div className="flex items-center mb-1">
            <label htmlFor="playlist" className="block text-xs font-medium text-gray-700">
              Playlist File
            </label>
            <span className="ml-2">
              <InfoTooltip 
                content="Ścieżka do pliku listy odtwarzania (M3U lub PLS) dla strumienia radiowego. Pozostaw puste jeśli nie używasz radia." 
                position="right"
              />
            </span>
          </div>
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
            <span className="ml-2">
              <InfoTooltip 
                content="Częstotliwość linii głosowych - czas pomiędzy odtwarzaniem kolejnych linii głosowych (w sekundach). Zalecany zakres to 30-300 sekund." 
                position="right"
              />
            </span>
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