import React, { useState } from 'react';
import api from '../utils/api';
import ConfirmationModal from './ui/ConfirmationModal';

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
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  // Function to initiate delete confirmation
  const initiateDelete = () => {
    if (selectedIds.length === 0) return;
    setShowConfirmation(true);
  };

  const hasSelection = selectedIds.length > 0;

  // Function to delete selected voice lines after confirmation
  const confirmDelete = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await api.post('/lines/remove', {
        ids: selectedIds
      });
      
      setShowConfirmation(false);
      onActionComplete();
    } catch (err: any) {
      console.error('Error while deleting lines:', err);
      setError(err.response?.data?.detail || 'Failed to delete voice lines');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {error && (
          <div className="text-red-500 text-sm mr-2">
            {error}
          </div>
        )}
        
        <span className={`text-sm ${hasSelection ? 'text-gray-700' : 'text-gray-400'}`}>
          {hasSelection ? `Zaznaczono: ${selectedIds.length}` : 'Brak zaznaczenia'}
        </span>
        
        <button
          onClick={() => handleToggleActive(true)}
          disabled={loading || !hasSelection}
          className={`py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border shadow-sm focus:outline-hidden ${
            hasSelection 
              ? 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 focus:bg-gray-50' 
              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="activate"
        >
          Aktywuj
        </button>
        
        <button
          onClick={() => handleToggleActive(false)}
          disabled={loading || !hasSelection}
          className={`py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border shadow-sm focus:outline-hidden ${
            hasSelection 
              ? 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 focus:bg-gray-50' 
              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="deactivate"
        >
          Dezaktywuj
        </button>
        
        <button
          onClick={initiateDelete}
          disabled={loading || !hasSelection}
          className={`py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border shadow-sm focus:outline-hidden ${
            hasSelection 
              ? 'border-red-200 bg-white text-red-600 hover:bg-red-50 focus:bg-red-50' 
              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="remove"
        >
          Usuń
        </button>
        
        <button
          onClick={onClearSelection}
          disabled={loading || !hasSelection}
          className={`py-1.5 px-2 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border shadow-sm focus:outline-hidden ${
            hasSelection 
              ? 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus:bg-gray-50' 
              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
        >
          Anuluj
        </button>
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        title="Usuń linie głosowe"
        message={`Czy na pewno chcesz usunąć ${selectedIds.length} ${selectedIds.length === 1 ? 'linię głosową' : selectedIds.length < 5 ? 'linie głosowe' : 'linii głosowych'}? Tej operacji nie można cofnąć.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        isLoading={loading}
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmation(false)}
        variant="danger"
      />
    </>
  );
};

export default BulkActions;