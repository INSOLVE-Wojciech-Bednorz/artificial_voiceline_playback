import React, { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '../utils/context/AppContext'; 
import EnhancedStatusIndicator from './ui/EnhancedStatusIndicator';

// Define custom event type for detecting unsaved changes
interface CheckUnsavedChangesEvent {
  callback: (canProceed: boolean) => void;
  targetPath: string;
}

declare global {
  interface WindowEventMap {
    'check_unsaved_changes': CustomEvent<CheckUnsavedChangesEvent>;
  }
}

const Header: React.FC = () => {
    const { schedulerActive, schedulerLoading } = useAppContext();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Function to determine if a link is active
    const isLinkActive = (path: string) => pathname === path;

    // Classes for active and inactive links
    const activeLinkClasses = "py-0.5 md:py-3 px-4 md:px-1 border-s-2 md:border-s-0 md:border-b-2 border-blue-600 font-medium text-blue-600 focus:outline-hidden transition-all duration-200 relative";
    const inactiveLinkClasses = "py-0.5 md:py-3 px-4 md:px-1 border-s-2 md:border-s-0 md:border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-600 transition-all duration-200 focus:outline-hidden relative hover:bg-blue-50/50 rounded-lg";

    // Function handling navigation with unsaved changes check
    const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
      // If clicking on an active link, do nothing
      if (isLinkActive(path)) {
        return;
      }
      
      e.preventDefault();
      
      // Always allow navigation TO settings page without checking unsaved changes
      if (path === '/settings') {
        console.log('Navigating directly to settings');
        router.push(path);
        return;
      }
      
      // Only check for unsaved changes when navigating FROM settings to other pages
      if (pathname === '/settings') {
        // Create event to check for unsaved changes
        const checkUnsavedEvent = new CustomEvent<CheckUnsavedChangesEvent>('check_unsaved_changes', {
          detail: {
            callback: (canProceed: boolean) => {
              if (canProceed) {
                router.push(path);
              }
            },
            targetPath: path
          }
        });
        
        // Dispatch the event and listen for handlers
        let wasHandled = false;
        
        // Add one-time listener to detect if the event is being handled
        const handleEventDetection = () => {
          wasHandled = true;
        };
        
        // Add listener before dispatch
        window.addEventListener('check_unsaved_changes', handleEventDetection, { once: true });
        
        // Dispatch the event
        window.dispatchEvent(checkUnsavedEvent);
        
        // Remove the detector listener
        window.removeEventListener('check_unsaved_changes', handleEventDetection);
        
        // Only navigate directly if no component is handling this event
        if (!wasHandled) {
          console.log(`No handler for unsaved changes, navigating directly to: ${path}`);
          router.push(path);
        }
      } else {
        // For all other pages, just navigate directly
        router.push(path);
      }
    }, [router, isLinkActive, pathname]);

    return (
        <header className="sticky top-0 inset-x-0 flex flex-wrap md:justify-start md:flex-nowrap z-50 w-full text-sm">
            <nav className={`mt-4 relative max-w-6xl w-full bg-white/90 backdrop-blur-md border border-gray-200/60 shadow-lg shadow-gray-200/30 ${isMenuOpen ? 'rounded-2xl' : 'rounded-full'} mx-2 py-2.5 md:flex md:items-center md:justify-between md:py-0 md:px-4 md:mx-auto transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/40`}>
                <div className="px-4 md:px-0 flex justify-between items-center">
                    <div className="flex items-center">
                        {/* Logo */}
                        <a 
                          className="flex-none rounded-md text-xl inline-block font-semibold focus:outline-hidden focus:opacity-80 transition-all duration-200 hover:scale-105" 
                          href="/" 
                          onClick={(e) => handleNavigation(e, '/')}
                          aria-label="Radio"
                        >
                            <div className="flex items-center">
                                <span className="mr-2 text-3xl text-blue-600 transition-colors duration-200 hover:text-blue-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 7.5 16.5-4.125M12 6.75c-2.708 0-5.363.224-7.948.655C2.999 7.58 2.25 8.507 2.25 9.574v9.176A2.25 2.25 0 0 0 4.5 21h15a2.25 2.25 0 0 0 2.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169A48.329 48.329 0 0 0 12 6.75Zm-1.683 6.443-.005.005-.006-.005.006-.005.005.005Zm-.005 2.127-.005-.006.005-.005.005.005-.005.005Zm-2.116-.006-.005.006-.006-.006.005-.005.006.005Zm-.005-2.116-.006-.005.006-.005.005.005-.005.005ZM9.255 10.5v.008h-.008V10.5h.008Zm3.249 1.88-.007.004-.003-.007.006-.003.004.006Zm-1.38 5.126-.003-.006.006-.004.004.007-.006.003Zm.007-6.501-.003.006-.007-.003.004-.007.006.004Zm1.37 5.129-.007-.004.004-.006.006.003-.004.007Zm.504-1.877h-.008v-.007h.008v.007ZM9.255 18v.008h-.008V18h.008Zm-3.246-1.87-.007.004L6 16.127l.006-.003.004.006Zm1.366-5.119-.004-.006.006-.004.004.007-.006.003ZM7.38 17.5l-.003.006-.007-.003.004-.007.006.004Zm-1.376-5.116L6 12.38l.003-.007.007.004-.004.007Zm-.5 1.873h-.008v-.007h.008v.007ZM17.25 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm0 4.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                                    </svg>
                                </span>
                                <span className="font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">RADIO</span>
                            </div>
                        </a>
                        {/* End Logo */}
                    </div>

                    <div className="md:hidden">
                        {/* Toggle Button */}
                        <button 
                            type="button" 
                            className="flex justify-center items-center size-7 border border-gray-200/60 text-gray-500 rounded-full hover:bg-gray-100/80 focus:outline-hidden focus:bg-gray-100/80 transition-all duration-200 hover:scale-105 hover:shadow-md"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-expanded={isMenuOpen}
                            aria-controls="navbar-menu"
                            aria-label="Toggle navigation"
                        >
                            {!isMenuOpen ? (
                                <svg className="shrink-0 size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" x2="21" y1="6" y2="6"/>
                                    <line x1="3" x2="21" y1="12" y2="12"/>
                                    <line x1="3" x2="21" y1="18" y2="18"/>
                                </svg>
                            ) : (
                                <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18"/>
                                    <path d="m6 6 12 12"/>
                                </svg>
                            )}
                        </button>
                        {/* End Toggle Button */}
                    </div>
                </div>

                <div 
                    id="navbar-menu"
                    className={`${isMenuOpen ? 'block' : 'hidden'} overflow-hidden transition-all duration-300 basis-full grow md:block`}
                >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2 md:gap-8 mt-3 md:mt-0 py-2 md:py-0 md:ps-7">
                        <a 
                            className={isLinkActive('/') ? activeLinkClasses : inactiveLinkClasses}
                            href="/" 
                            onClick={(e) => handleNavigation(e, '/')}
                            aria-current={isLinkActive('/') ? "page" : undefined}
                        >
                            Home
                        </a>
                        <a 
                            className={isLinkActive('/settings') ? activeLinkClasses : inactiveLinkClasses}
                            href="/settings"
                            onClick={(e) => handleNavigation(e, '/settings')}
                            aria-current={isLinkActive('/settings') ? "page" : undefined}
                        >
                            Settings
                        </a>
                        
                        {/* Connection Status Indicator */}
                        <EnhancedStatusIndicator 
                            active={schedulerActive} 
                            loading={schedulerLoading} 
                            label="Status"
                        />
                    </div>
                </div>
            </nav>
        </header>
    );
}

export default Header;