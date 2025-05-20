import React, { useState, useRef, useEffect } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  iconSize?: 'sm' | 'md' | 'lg';
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  content, 
  position = 'top',
  iconSize = 'sm'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Define icon size classes
  const iconClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Add a small delay before showing/hiding tooltip to prevent flickering
  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 100);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Calculate the position based on the provided position prop
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2';
      case 'right':
        return 'left-full ml-2';
      case 'bottom':
        return 'top-full mt-2';
      case 'left':
        return 'right-full mr-2';
      default:
        return 'top-0 left-full ml-2';
    }
  };
  
  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        className="text-gray-400 hover:text-blue-500 focus:outline-none transition-colors duration-200"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-label="Pokaż więcej informacji"
      >
        <InformationCircleIcon className={iconClasses[iconSize]} />
      </button>
      
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`absolute z-50 ${getPositionClasses()}`}
          style={{ 
            minWidth: '250px',
            maxWidth: '320px'
          }}
        >
          <div 
            className="bg-gray-100 border border-gray-300 text-gray-800 text-sm rounded-md shadow-md p-3 animate-fadeIn"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
          >
            <div className="flex items-start">
              <div className="mr-2 mt-0.5 text-blue-600 flex-shrink-0">
                <InformationCircleIcon className="w-4 h-4" />
              </div>
              <div>{content}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;