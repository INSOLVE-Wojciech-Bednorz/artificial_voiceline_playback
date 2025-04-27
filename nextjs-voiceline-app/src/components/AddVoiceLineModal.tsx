import React, { useState } from 'react';
import api from '../utils/api';

interface AddVoiceLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceLineAdded: () => void;
}

const AddVoiceLineModal: React.FC<AddVoiceLineModalProps> = ({ 
  isOpen, 
  onClose, 
  onVoiceLineAdded 
}) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!text.trim()) {
      setError("Tekst nie może być pusty");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      await api.post('/lines', { text });
      // Call onVoiceLineAdded first to ensure refresh happens
      onVoiceLineAdded();
      // Then close the modal
      handleClose();
    } catch (err: any) {
      console.error('Błąd podczas dodawania linii głosowej:', err);
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Nie udało się dodać linii głosowej. Spróbuj ponownie.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setText('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md relative animate-fadeIn">
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          type="button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <h2 className="text-xl font-bold mb-4">Dodaj nową linię głosową</h2>
        
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
              placeholder="Wprowadź tekst dla nowej linii głosowej..."
              disabled={loading}
            ></textarea>
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
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
                  Tworzenie...
                </div>
              ) : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVoiceLineModal;