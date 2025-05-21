import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import ApiErrorHandler from './ui/ApiErrorHandler';
import { formatApiError } from '../utils/errorUtils';
import ConfirmationModal from './ui/ConfirmationModal';

interface EditVoiceLineProps {
  lineId: number;
  currentText: string;
  isActive: boolean;
  isOpen: boolean;
  onClose: () => void;
  onVoiceLineUpdated: () => void;
}

const EditVoiceLine: React.FC<EditVoiceLineProps> = ({ 
  lineId,
  currentText,
  isActive,
  isOpen,
  onClose,
  onVoiceLineUpdated 
}) => {
  const [text, setText] = useState('');
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const needsRefreshRef = useRef(false);

  // Set initial text and active state when component opens
  useEffect(() => {
    if (isOpen) {
      setText(currentText);
      setActive(isActive);
      setError(null);
      needsRefreshRef.current = false;
    }
  }, [isOpen, currentText, isActive]);

  const handleCloseModal = () => {
    // If we toggled active state, refresh the list when closing
    if (needsRefreshRef.current && onVoiceLineUpdated) {
      onVoiceLineUpdated();
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError("Tekst nie może być pusty");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.put(`/lines/${lineId}`, { new_text: text });
      
      // Always refresh on submit
      if (onVoiceLineUpdated) {
        onVoiceLineUpdated();
      }
      
      handleCloseModal();
    } catch (err: any) {
      console.error('Błąd podczas aktualizacji linii głosowej:', err);
      // Use centralized error formatting
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling active state
  const handleToggleActive = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default form submission
    e.stopPropagation(); // Stop event propagation
    
    setToggleLoading(true);
    setError(null);
    
    const newActiveState = !active;
    
    try {
      // Call API to toggle line active status
      await api.post('/lines/toggle', {
        ids: [lineId],
        state: newActiveState
      });
      
      // Update local state immediately
      setActive(newActiveState);
      
      // Mark that we need to refresh when closing the modal
      needsRefreshRef.current = true;
      
    } catch (err: any) {
      console.error('Błąd podczas zmiany statusu linii głosowej:', err);
      // Use centralized error formatting
      setError(formatApiError(err));
    } finally {
      setToggleLoading(false);
    }
  };

  // Initiate delete process
  const initiateDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirmation(true);
  };

  // Handle delete confirmation
  const handleDelete = async () => {
    setDeleteLoading(true);
    setError(null);
    
    try {
      await api.post('/lines/remove', {
        ids: [lineId]
      });
      
      // Close confirmation modal
      setShowDeleteConfirmation(false);
      
      // Close edit modal
      handleCloseModal();
      
      // Refresh the list
      if (onVoiceLineUpdated) {
        onVoiceLineUpdated();
      }
    } catch (err: any) {
      console.error('Błąd podczas usuwania linii głosowej:', err);
      setError(formatApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-md relative animate-fadeIn">
          <button 
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <h2 className="text-xl font-bold mb-4">Edytuj linię głosową #{lineId}</h2>
          
          {/* Status indicator and toggle button */}
          <div className="flex items-center mb-6 gap-2">
            <div className={`px-2 py-1 rounded-md text-xs font-medium ${
              active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {active ? 'Aktywna' : 'Nieaktywna'}
            </div>
            
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={toggleLoading}
              className={`flex items-center text-xs px-3 py-1 rounded-md transition-colors ${
                active 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {toggleLoading ? (
                <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                active ? 'Dezaktywuj' : 'Aktywuj'
              )}
            </button>

            <button
              type="button"
              onClick={initiateDelete}
              disabled={toggleLoading || loading}
              className="flex items-center text-xs px-3 py-1 ml-auto rounded-md transition-colors bg-red-600 hover:bg-red-700 text-white"
            >
              Usuń
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="voiceLineText" className="block text-sm font-medium text-gray-700 mb-1">
                Tekst linii głosowej
              </label>
              <textarea
                id="voiceLineText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Wprowadź nowy tekst dla linii głosowej..."
                disabled={loading}
              ></textarea>
            </div>
            
            {error && (
              <ApiErrorHandler 
                error={error} 
                onDismiss={() => setError(null)} 
              />
            )}
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                disabled={loading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Aktualizacja...
                  </div>
                ) : 'Zapisz zmiany'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Usuń linię głosową"
        message={`Czy na pewno chcesz usunąć linię głosową #${lineId}? Tej operacji nie można cofnąć.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        isLoading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirmation(false)}
        variant="danger"
      />
    </>
  );
};

export default EditVoiceLine;