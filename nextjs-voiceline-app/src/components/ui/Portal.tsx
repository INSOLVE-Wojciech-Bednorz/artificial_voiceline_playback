'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
  container?: Element | null;
}

const Portal: React.FC<PortalProps> = ({ children, container }) => {
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<Element | null>(null);

  useEffect(() => {
    // Ensure we're on the client side
    setMounted(true);
    
    // Use provided container or default to document.body
    const targetContainer = container || document.body;
    setPortalContainer(targetContainer);
  }, [container]);

  // Don't render anything on the server or before mounting
  if (!mounted || !portalContainer) {
    return null;
  }

  return createPortal(children, portalContainer);
};

export default Portal;
