import React from 'react';

interface LoadingStateProps {
  title: string;
  subtitle: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ title, subtitle }) => {
  return (
    <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto">
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
              <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    {title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Zarządzaj liniami głosowymi dla swojego systemu.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin h-12 w-12 text-blue-500 mb-4 mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-800">{subtitle}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;