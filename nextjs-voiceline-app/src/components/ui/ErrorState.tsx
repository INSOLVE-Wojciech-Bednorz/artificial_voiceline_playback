import React from 'react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry }) => {
  return (
    <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto animate-slideIn">
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-lg hover:shadow-xl overflow-hidden transition-all duration-200">
              <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-white/20 bg-gradient-to-r from-gray-50/50 to-gray-100/50 backdrop-blur-sm">
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
                  <div className="bg-gradient-to-br from-red-50/80 via-red-50/60 to-red-100/80 backdrop-blur-sm border border-red-200/50 rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                    <div className="text-red-500 mb-3">
                      <div className="animate-pulse">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 drop-shadow-md">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-red-800">{title}</h3>
                    </div>
                    <p className="text-gray-700 mb-6 leading-relaxed">{message}</p>
                    <button 
                      onClick={onRetry}
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 focus:ring-2 focus:ring-red-300/50 focus:outline-none"
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