import React from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
  onAddNew: () => void;
  onRefresh: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, message, onAddNew, onRefresh }) => {
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
                <div>
                  <div className="inline-flex gap-x-2">
                    <button 
                      onClick={onAddNew}
                      className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 focus:outline-hidden focus:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      Dodaj linię głosową
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="text-center p-8">
                <div className="text-gray-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-700 mb-2">{title}</h3>
                <p className="text-gray-500 mb-6">{message}</p>
                <div className="flex justify-center gap-3">
                  <button 
                    onClick={onRefresh} 
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Odśwież
                  </button>
                  <button 
                    onClick={onAddNew} 
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Dodaj nową linię
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmptyState;