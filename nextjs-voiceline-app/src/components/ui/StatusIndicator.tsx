import React from 'react';

interface StatusIndicatorProps {
  active: boolean;
  loading: boolean;
  label: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ active, loading, label }) => {
  // Określ kolory w zależności od statusu
  const borderColor = active ? 'border-green-600' : 'border-red-500';
  const textColor = active ? 'text-green-600' : 'text-red-500';
  const dotBgColor = active ? 'bg-green-500' : 'bg-red-300';
  const dotAnimateColor = active ? 'bg-green-400' : 'bg-red-200';
  const customShadowStyle = active 
    ? { boxShadow: '0px 0px 20px 5px rgba(134, 239, 172, 0.5)' }  // green-300 with 50% opacity
    : { boxShadow: '0px 0px 20px 1px rgba(252, 165, 165, 0.5)' };  // red-300 with 50% opacity

  return (
    <div 
      className={`rounded-xl border px-4 py-2 font-normal flex items-center ${borderColor} ${textColor} shadow-lg`} 
      style={customShadowStyle}
    >
      <span className="relative flex size-3 mr-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotAnimateColor} opacity-75`}></span>
        <span className={`relative inline-flex size-3 rounded-full ${dotBgColor}`}></span>
      </span>
      {label}: {loading ? "Ładowanie..." : (active ? "Aktywny" : "Nieaktywny")}
    </div>
  );
};

export default StatusIndicator;