import React from 'react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry }) => {
  return (
    <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Linie głosowe
                  </h2>
                  <p className="text-sm text-gray-600">
                    Zarządzaj liniami głosowymi dla swojego systemu.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center p-8">
                <div className="text-center p-6 max-w-md">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="text-red-500 mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <h3 className="text-lg font-medium text-red-800">{title}</h3>
                    </div>
                    <p className="text-gray-700 mb-4">{message}</p>
                    <button 
                      onClick={onRetry}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      Odśwież stronę
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;