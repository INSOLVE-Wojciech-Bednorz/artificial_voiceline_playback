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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative animate-fadeIn max-h-[90vh] flex flex-col">
          <button 
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Edytuj linię głosową #{lineId}</h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {active ? 'Aktywna' : 'Nieaktywna'}
              </div>
            </div>
          </div>
          
          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 flex-1 flex flex-col min-h-0">
              <label htmlFor="voiceLineText" className="block text-sm font-medium text-gray-700 mb-3">
                Tekst linii głosowej
              </label>
              <textarea
                id="voiceLineText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm leading-relaxed min-h-[300px]"
                placeholder="Wprowadź tekst dla linii głosowej..."
                disabled={loading}
              ></textarea>
            </div>
            
            {error && (
              <div className="px-6 pb-4">
                <ApiErrorHandler 
                  error={error} 
                  onDismiss={() => setError(null)} 
                />
              </div>
            )}
            
            {/* Footer with buttons */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleToggleActive}
                    disabled={toggleLoading}
                    className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      active 
                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg' 
                        : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                    } ${toggleLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {toggleLoading ? (
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : null}
                    {active ? 'Dezaktywuj' : 'Aktywuj'}
                  </button>

                  <button
                    type="button"
                    onClick={initiateDelete}
                    disabled={toggleLoading || loading}
                    className="flex items-center px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Usuń
                  </button>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
                    disabled={loading}
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Zapisywanie...
                      </div>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        Zapisz zmiany
                      </>
                    )}
                  </button>
                </div>
              </div>
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