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
    } catch (err: unknown) {
      console.error(`Error while changing line status to ${state ? 'active' : 'inactive'}:`, err);
      if (err instanceof Error && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Failed to update voice lines');
      } else {
        setError('Failed to update voice lines');
      }
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
    } catch (err: unknown) {
      console.error('Error while deleting lines:', err);
      if (err instanceof Error && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Failed to delete voice lines');
      } else {
        setError('Failed to delete voice lines');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg">
        {error && (
          <div className="text-red-600 text-sm mr-2 px-3 py-1 bg-red-50/80 backdrop-blur-sm rounded-lg border border-red-200/50">
            {error}
          </div>
        )}
        
        <span className={`text-sm font-medium ${hasSelection ? 'text-gray-700' : 'text-gray-400'} transition-colors duration-200`}>
          {hasSelection ? `Zaznaczono: ${selectedIds.length}` : 'Brak zaznaczenia'}
        </span>
        
        <button
          onClick={() => handleToggleActive(true)}
          disabled={loading || !hasSelection}
          className={`py-2 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg backdrop-blur-sm transition-all duration-200 ${
            hasSelection 
              ? 'bg-green-500/90 text-white hover:bg-green-600/90 hover:scale-105 focus:bg-green-600/90 focus:ring-2 focus:ring-green-300/50 shadow-lg hover:shadow-xl' 
              : 'bg-gray-100/80 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="activate"
        >
          Aktywuj
        </button>
        
        <button
          onClick={() => handleToggleActive(false)}
          disabled={loading || !hasSelection}
          className={`py-2 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg backdrop-blur-sm transition-all duration-200 ${
            hasSelection 
              ? 'bg-orange-500/90 text-white hover:bg-orange-600/90 hover:scale-105 focus:bg-orange-600/90 focus:ring-2 focus:ring-orange-300/50 shadow-lg hover:shadow-xl' 
              : 'bg-gray-100/80 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="deactivate"
        >
          Dezaktywuj
        </button>
        
        <button
          onClick={initiateDelete}
          disabled={loading || !hasSelection}
          className={`py-2 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg backdrop-blur-sm transition-all duration-200 ${
            hasSelection 
              ? 'bg-red-500/90 text-white hover:bg-red-600/90 hover:scale-105 focus:bg-red-600/90 focus:ring-2 focus:ring-red-300/50 shadow-lg hover:shadow-xl' 
              : 'bg-gray-100/80 text-gray-400 cursor-not-allowed'
          } disabled:opacity-50 disabled:pointer-events-none`}
          data-action="remove"
        >
          Usuń
        </button>
        
        <button
          onClick={onClearSelection}
          disabled={loading || !hasSelection}
          className={`py-2 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg backdrop-blur-sm transition-all duration-200 ${
            hasSelection 
              ? 'bg-gray-500/90 text-white hover:bg-gray-600/90 hover:scale-105 focus:bg-gray-600/90 focus:ring-2 focus:ring-gray-300/50 shadow-lg hover:shadow-xl' 
              : 'bg-gray-100/80 text-gray-400 cursor-not-allowed'
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