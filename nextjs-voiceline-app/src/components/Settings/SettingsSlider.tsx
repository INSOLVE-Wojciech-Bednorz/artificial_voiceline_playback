import React from 'react';

interface SettingsSliderProps {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

const SettingsSlider: React.FC<SettingsSliderProps> = ({
  id,
  name,
  min,
  max,
  step,
  value,
  onChange,
  disabled = false,
  className = ''
}) => {
  // Calculate percentage for CSS custom property
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`settings-slider-container ${className}`}>
      <input
        type="range"
        id={id}
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="settings-slider"
        style={{ 
          '--progress': `${percentage}%` 
        } as React.CSSProperties}
      />
    </div>
  );
};

export default SettingsSlider;
