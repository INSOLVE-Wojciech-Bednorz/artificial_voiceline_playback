"use client";

import React from 'react';
import Tooltip from './Tooltip';
import type { Placement } from '@floating-ui/react-dom';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  iconSize?: 'sm' | 'md' | 'lg';
  zIndex?: number;
}

// Compatibility component that wraps the new Tooltip
const InfoTooltip: React.FC<InfoTooltipProps> = ({ 
  content, 
  position = 'top',
  iconSize = 'sm'
}) => {
  // Convert position to Placement type
  const mappedPosition: Placement = position as Placement;
  
  return (
    <Tooltip 
      content={content}
      position={mappedPosition}
      iconSize={iconSize}
      maxWidth={350}
      showIcon={true}
    />
  );
};

export default InfoTooltip;
