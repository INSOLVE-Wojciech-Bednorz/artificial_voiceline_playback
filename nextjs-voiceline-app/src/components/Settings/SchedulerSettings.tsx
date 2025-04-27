import React from 'react';

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
      <h3 className="text-lg font-medium mb-3">Scheduler Settings</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="scheduler-interval" className="block text-sm font-medium">
            Interval (seconds)
          </label>
          <div className="mt-2">
            <input
              id="scheduler-interval"
              type="number"
              min="5"
              max="600"
              value={interval}
              onChange={(e) => onChange('interval', Math.max(5, Math.min(600, Number(e.target.value))))}
              className="py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Time between voice line playback (5-600 seconds)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulerSettings;