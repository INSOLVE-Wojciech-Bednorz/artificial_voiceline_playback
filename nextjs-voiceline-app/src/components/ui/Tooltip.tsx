"use client";

import React, { useState, useRef } from 'react';
import { useFloating, offset, shift, flip, arrow, autoUpdate, Placement } from '@floating-ui/react-dom';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  content: React.ReactNode;
  position?: Placement;
  iconSize?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
  maxWidth?: number;
  showIcon?: boolean;
}

export default function Tooltip({
  content,
  position = 'top',
  iconSize = 'sm',
  children,
  className = '',
  maxWidth = 350,
  showIcon = true,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Icon size classes
  const iconClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  // Setup floating UI with simplified approach
  const { x, y, strategy, refs, placement, middlewareData } = useFloating({
    placement: position,
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef })
    ],
    whileElementsMounted: autoUpdate
  });

  // Handle mouse events with delay for better UX
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  // Calculate arrow position
  const getArrowStyling = () => {
    if (!middlewareData.arrow) return {};

    const { x: arrowX, y: arrowY } = middlewareData.arrow;
    const staticSide = {
      top: 'bottom',
      right: 'left',
      bottom: 'top',
      left: 'right'
    }[placement.split('-')[0]];

    return {
      left: arrowX != null ? `${arrowX}px` : '',
      top: arrowY != null ? `${arrowY}px` : '',
      right: '',
      bottom: '',
      [staticSide as string]: '-4px'
    };
  };

  // Animation variants
  const tooltipVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.15, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.1, ease: "easeIn" }
    }
  };

  return (
    <div 
      className={`inline-flex items-center justify-center relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      ref={refs.setReference}
    >
      {children || (showIcon && (
        <button
          type="button"
          className="text-gray-400 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded-full flex items-center justify-center"
          aria-label="Show more information"
        >
          <InformationCircleIcon className={iconClasses[iconSize]} />
        </button>
      ))}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={refs.setFloating}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              zIndex: 9999,
              maxWidth: maxWidth,
              width: 'max-content',
            }}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={tooltipVariants}
            className="absolute"
          >
            <div className="bg-white rounded-lg p-3 shadow-lg border border-gray-100">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 flex-shrink-0 mt-0.5">
                  <InformationCircleIcon className="w-4 h-4" />
                </div>
                <div className="text-sm text-gray-800 break-words">{content}</div>
              </div>
              <div
                ref={arrowRef}
                className="absolute w-2 h-2 bg-white rotate-45 border-gray-100"
                style={{
                  ...getArrowStyling(),
                  borderStyle: 'solid',
                  borderWidth: '0'
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 