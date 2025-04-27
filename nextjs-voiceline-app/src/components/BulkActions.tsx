import React, { useState } from 'react';
import api from '../utils/api';

interface BulkActionsProps {
  selectedIds: number[];
  onActionComplete: () => void;
  onClearSelection: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({ 
  selectedIds,
  onActionComplete,
  onClearSelection
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to toggle active state of selected voice lines
  const handleToggleActive = async (state: boolean) => {
    if (selectedIds.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await api.post('/lines/toggle', {
        ids: selectedIds,
        state: state
      });
      
      onActionComplete();
    } catch (err: any) {
      console.error(`Error while changing line status to ${state ? 'active' : 'inactive'}:`, err);
      setError(err.response?.data?.detail || 'Failed to update voice lines');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete selected voice lines
  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected voice lines? This action cannot be undone.`)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.post('/lines/remove', {
        ids: selectedIds
      });
      
      onActionComplete();
    } catch (err: any) {
      console.error('Error while deleting lines:', err);
      setError(err.response?.data?.detail || 'Failed to delete voice lines');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <div className="text-red-500 text-sm mr-2">
          {error}
        </div>
      )}
      
      <button
        onClick={() => handleToggleActive(true)}
        disabled={loading}
        className="py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
        data-action="activate"
      >
        Activate
      </button>
      
      <button
        onClick={() => handleToggleActive(false)}
        disabled={loading}
        className="py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
        data-action="deactivate"
      >
        Deactivate
      </button>
      
      <button
        onClick={handleDelete}
        disabled={loading}
        className="py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-red-50"
        data-action="remove"
      >
        Delete
      </button>
      
      <button
        onClick={onClearSelection}
        disabled={loading}
        className="py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus:outline-hidden focus:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
};

export default BulkActions;