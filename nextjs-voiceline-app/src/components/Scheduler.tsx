import React from 'react';
import { useAppContext } from '../lib/context/AppContext';

const Scheduler: React.FC = () => {
  const { 
    schedulerActive,
    schedulerLoading,
    schedulerError,
    toggleScheduler
  } = useAppContext();
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col mb-6">
      <h2 className="text-lg font-medium mb-3">Kontrola Schedulera</h2>
      
      <div className="mb-4">
        <div className="flex items-center text-sm">
          <span className="font-medium mr-1">Status:</span>
          <span className={schedulerActive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {schedulerActive ? 'Aktywny' : 'Zatrzymany'}
          </span>
        </div>
      </div>
      
      {schedulerError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-3">
          {schedulerError}
        </div>
      )}
      
      <button
        onClick={toggleScheduler}
        disabled={schedulerLoading}
        className={`mt-auto py-2 px-4 rounded-md text-sm font-medium text-white transition-colors ${
          schedulerLoading ? 'bg-gray-300 cursor-not-allowed' : 
          schedulerActive ? 
            'bg-red-500 hover:bg-red-600' : 
            'bg-green-500 hover:bg-green-600'
        }`}
      >
        {schedulerLoading ? 'Przetwarzanie...' : schedulerActive ? 'Zatrzymaj Scheduler' : 'Uruchom Scheduler'}
      </button>
    </div>
  );
};

export default Scheduler;

