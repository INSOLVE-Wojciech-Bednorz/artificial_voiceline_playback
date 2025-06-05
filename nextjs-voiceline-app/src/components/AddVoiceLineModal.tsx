import React, { useState } from 'react';
import api from '../utils/api';
import ApiErrorHandler from './ui/ApiErrorHandler';
import { formatApiError } from '../utils/errorUtils';

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
      // Use centralized error formatting
      setError(formatApiError(err));
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      {/* Modal container with improved responsive design */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh] flex flex-col border border-gray-200 animate-slideIn overflow-hidden mx-auto">
        {/* Minimalist Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dodaj nową linię głosową</h2>
              <p className="text-sm text-gray-500">Utwórz nową linię dźwiękową</p>
            </div>
          </div>
          
          <button 
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
            type="button"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Text Input Section */}
          <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-emerald-50/30 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Tekst linii głosowej</h3>
                <p className="text-sm text-gray-500">Wprowadź treść do wygenerowania audio</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm">
              <div className="flex-1 relative min-h-[250px]">
                <textarea
                  id="voiceLineText"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full h-full border-2 border-gray-200 rounded-xl p-6 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none text-base leading-relaxed transition-all duration-200 placeholder-gray-400 shadow-sm hover:shadow-md hover:border-gray-300"
                  placeholder="Wprowadź tekst dla nowej linii głosowej...&#10;&#10;💡 Wskazówka: Możesz używać znaków interpunkcyjnych aby kontrolować intonację i pauzy w generowanym audio."
                  disabled={loading}
                  style={{minHeight: '220px'}}
                ></textarea>
                
                {/* Character count */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 shadow-sm">
                  {text.length} znaków
                </div>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="px-6 pb-4">
              <ApiErrorHandler 
                error={error} 
                onDismiss={() => setError(null)} 
              />
            </div>
          )}
          
          {/* Footer with improved responsive buttons */}
          <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg min-w-[100px]"
                disabled={loading}
              >
                Anuluj
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 disabled:from-emerald-300 disabled:to-green-300 font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none min-w-[140px]"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Tworzenie...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Utwórz linię
                  </div>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVoiceLineModal;