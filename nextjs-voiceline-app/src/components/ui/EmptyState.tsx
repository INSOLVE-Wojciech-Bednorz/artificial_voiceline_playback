import React from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
  onAddNew: () => void;
  onRefresh: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, message, onAddNew, onRefresh }) => {
  return (
    <div className="max-w-[85rem] px-4 py-10 sm:px-6 lg:px-8 lg:py-14 mx-auto animate-slideIn">
      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="p-1.5 min-w-full inline-block align-middle">
            <div className="bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-lg hover:shadow-xl overflow-hidden transition-all duration-200">
              <div className="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-white/20 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 backdrop-blur-sm">
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
                      className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-transparent bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 focus:ring-2 focus:ring-blue-300/50 focus:outline-none"
                    >
                      <svg className="shrink-0 size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                      Dodaj linię głosową
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="text-center p-12">
                <div className="bg-gradient-to-br from-gray-50/80 via-blue-50/60 to-indigo-50/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200 max-w-md mx-auto">
                  <div className="text-gray-400 mb-6">
                    <div className="animate-pulse">
                      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto drop-shadow-md">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">{title}</h3>
                  <p className="text-gray-600 mb-8 leading-relaxed">{message}</p>
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={onRefresh} 
                      className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-lg hover:scale-105 focus:ring-2 focus:ring-gray-300/50 focus:outline-none"
                    >
                      Odśwież
                    </button>
                    <button 
                      onClick={onAddNew} 
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105 focus:ring-2 focus:ring-blue-300/50 focus:outline-none"
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
    </div>
  );
};

export default EmptyState;