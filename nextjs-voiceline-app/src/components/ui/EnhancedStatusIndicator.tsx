import React from 'react';

interface EnhancedStatusIndicatorProps {
  active: boolean;
  loading: boolean;
  label: string;
}

const EnhancedStatusIndicator: React.FC<EnhancedStatusIndicatorProps> = ({ active, loading, label }) => {
  // Gradient colors based on status
  const gradientClasses = active 
    ? 'from-green-300 via-green-500 to-green-600 text-white' 
    : 'from-red-300 via-red-500 to-red-600 text-white';

  // Animation for border effect
  const borderAnimation = active
    ? 'animate-borderGlowGreen'
    : 'animate-borderGlowRed';

  // Text status
  const statusText = loading ? "Ładowanie..." : (active ? "Aktywny" : "Nieaktywny");
  
  return (
    <div className="relative py-1 flex items-center">
      {/* Animated border container - rozszerzony względem elementu wewnętrznego */}
      <div className={`absolute -inset-1 rounded-full ${borderAnimation} opacity-90`}></div>
      
      {/* Main indicator container - z padding */}
      <div 
        className={`relative px-5 py-2 rounded-full bg-gradient-to-r ${gradientClasses} flex items-center font-medium shadow-lg z-10`}
      >
        {/* Pulse dot */}
        <span className="relative flex size-3.5 mr-3">
          <span className={`absolute inline-flex h-full w-full ${active ? 'animate-ping' : ''} rounded-full ${active ? 'bg-white/70' : 'bg-white/50'} opacity-75`}></span>
          <span className="relative inline-flex size-3.5 rounded-full bg-white"></span>
        </span>
        
        {/* Label and status */}
        <span className="font-medium tracking-wide">
          {label}: <span className="font-bold">{statusText}</span>
        </span>
      </div>
    </div>
  );
};

export default EnhancedStatusIndicator;