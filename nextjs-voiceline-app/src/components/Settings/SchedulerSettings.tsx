import React from 'react';
import InfoTooltip from '../ui/InfoTooltip';

interface SchedulerSettingsProps {
  settings: {
    interval: number;
  };
  onChange: (field: string, value: any) => void;
}

const SchedulerSettings: React.FC<SchedulerSettingsProps> = ({ settings, onChange }) => {
  // Provide fallback values if settings is undefined
  const interval = settings?.interval ?? 60; // Default to 60 seconds if undefined

  return (
    <div>
      <h3 className="text-lg font-medium mb-3 flex items-center">
        Scheduler Settings
        <span className="ml-2">
          <InfoTooltip 
            content="Ustawienia harmonogramu określają częstotliwość odtwarzania linii głosowych w aplikacji." 
            iconSize="md"
          />
        </span>
      </h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex items-center mb-1">
            <label htmlFor="scheduler-interval" className="block text-sm font-medium">
              Interval (seconds)
            </label>
            <span className="ml-2">
              <InfoTooltip 
                content="Odstęp czasowy pomiędzy odtworzeniem kolejnych linii głosowych. Wyższe wartości dają rzadsze komunikaty, niższe - częstsze. Zakres od 5 sekund do 1 godziny (3600 sekund). Zalecany zakres to 30-300 sekund dla optymalnego użytku." 
                position="right"
              />
            </span>
          </div>
          <div className="mt-2">
            <input
              id="scheduler-interval"
              type="number"
              min="5"
              max="3600"
              value={interval}
              onChange={(e) => onChange('interval', Number(e.target.value))}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value < 5) onChange('interval', 5);
                else if (value > 3600) onChange('interval', 3600);
              }}
              className="py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Time between voice line playback (5-3600 seconds / 5s-1h)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulerSettings;