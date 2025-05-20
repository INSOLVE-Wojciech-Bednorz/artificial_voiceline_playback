import React, { useState, useEffect } from 'react';
import InfoTooltip from '../ui/InfoTooltip';

interface SchedulerSettingsProps {
  settings: {
    interval: number;
  };
  onChange: (field: string, value: any) => void;
}

type TimeUnit = 'seconds' | 'minutes' | 'hours';

const SchedulerSettings: React.FC<SchedulerSettingsProps> = ({ settings, onChange }) => {
  // Provide fallback values if settings is undefined
  const intervalInSeconds = settings?.interval ?? 60; // Default to 60 seconds if undefined
  
  // Determine initial time unit based on interval value
  const determineInitialUnit = (seconds: number): TimeUnit => {
    if (seconds >= 3600) return 'hours';
    if (seconds >= 60) return 'minutes';
    return 'seconds';
  };
  
  // State for the selected time unit and the corresponding value
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('seconds');
  const [intervalValue, setIntervalValue] = useState<number>(intervalInSeconds);
  
  // Min and max values for each time unit
  const limits = {
    seconds: { min: 5, max: 3600 },
    minutes: { min: 1, max: 60 },
    hours: { min: 1, max: 1 }
  };
  
  // Convert the interval in seconds to the selected unit when component mounts or unit changes
  useEffect(() => {
    updateIntervalValueBasedOnUnit(intervalInSeconds);
  }, [timeUnit, intervalInSeconds]);
  
  // Convert between seconds and the selected unit
  const updateIntervalValueBasedOnUnit = (seconds: number) => {
    if (timeUnit === 'minutes') {
      setIntervalValue(Math.round(seconds / 60));
    } else if (timeUnit === 'hours') {
      setIntervalValue(Math.round(seconds / 3600));
    } else {
      setIntervalValue(seconds);
    }
  };
  
  // Convert from selected unit to seconds and update the parent component
  const handleValueChange = (value: number) => {
    let secondsValue: number;
    
    // Convert to seconds based on the selected unit
    if (timeUnit === 'minutes') {
      secondsValue = value * 60;
    } else if (timeUnit === 'hours') {
      secondsValue = value * 3600;
    } else {
      secondsValue = value;
    }
    
    // Apply min-max constraints in seconds
    if (secondsValue < 5) secondsValue = 5;
    if (secondsValue > 3600) secondsValue = 3600;
    
    // Update local state with the converted value
    setIntervalValue(value);
    
    // Send the value in seconds to the parent component
    onChange('interval', secondsValue);
  };
  
  // Handle changing the time unit
  const handleUnitChange = (unit: TimeUnit) => {
    setTimeUnit(unit);
  };
  
  return (
    <div>
      <h3 className="text-lg font-medium mb-3 flex items-center">
        Ustawienia harmonogramu
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
              Interwał odtwarzania
            </label>
            <span className="ml-2">
              <InfoTooltip 
                content="Odstęp czasowy pomiędzy odtworzeniem kolejnych linii głosowych. Wyższe wartości dają rzadsze komunikaty, niższe - częstsze. Wybierz jednostkę czasu z listy (sekundy, minuty lub godziny)." 
                position="right"
              />
            </span>
          </div>
          
          {/* Input group with number input and unit selector */}
          <div className="mt-2 flex">
            <div className="relative rounded-md shadow-sm flex-1">
              <input
                id="scheduler-interval"
                type="number"
                min={limits[timeUnit].min}
                max={limits[timeUnit].max}
                value={intervalValue}
                onChange={(e) => handleValueChange(Number(e.target.value))}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value < limits[timeUnit].min) handleValueChange(limits[timeUnit].min);
                  else if (value > limits[timeUnit].max) handleValueChange(limits[timeUnit].max);
                }}
                className="py-1.5 sm:py-2 px-3 block w-full border-gray-200 rounded-l-lg focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="inline-flex">
              <div className="relative inline-block text-left">
                <div className="h-full">
                  <select
                    value={timeUnit}
                    onChange={(e) => handleUnitChange(e.target.value as TimeUnit)}
                    className="pl-3 pr-8 py-1.5 sm:py-2 h-full appearance-none border border-gray-200 rounded-r-lg bg-blue-50 focus:border-blue-500 focus:ring-blue-500 text-sm font-medium text-gray-700 min-w-[100px] border-l-0"
                    aria-label="Wybierz jednostkę czasu"
                    style={{ backgroundColor: '#EBF5FF' }}
                  >
                    <option value="seconds">Sekundy</option>
                    <option value="minutes">Minuty</option>
                    <option value="hours">Godziny</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <p className="mt-1 text-xs text-gray-500">
            Czas między odtwarzaniem linii głosowych (zakres: 5 sekund - 1 godzina)
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulerSettings;