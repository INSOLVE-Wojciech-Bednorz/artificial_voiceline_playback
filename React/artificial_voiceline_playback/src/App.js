import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import './App.css';
import Settings from './components/Settings';
import SchedulerControl from './components/SchedulerControl';
import VoiceLineForm from './components/VoiceLineForm';
import BulkActions from './components/BulkActions';
import VoiceLinesTable from './components/VoiceLinesTable';
import VoiceLineDetails from './components/VoiceLineDetails';

const App = () => {
    // Stan dla aktywnej zakładki
    const [activeTab, setActiveTab] = useState('voice-lines');
    
    // Stan dla linii głosowych
    const [voicelines, setVoicelines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedVoiceline, setSelectedVoiceline] = useState(null);
    const [selectedVoicelineIds, setSelectedVoicelineIds] = useState([]);
    
    // Stan dla schedulera
    const [schedulerStatus, setSchedulerStatus] = useState(false);

    // Pobieranie linii głosowych
    const fetchVoiceLines = useCallback(async () => {
        try {
            const response = await api.get('/lines');
            setVoicelines(response.data);
            setError(null);
            
            // Aktualizacja wybranej linii głosowej, jeśli istnieje w nowych danych
            if (selectedVoiceline?.id) {
                const updated = response.data.find(line => line.id === selectedVoiceline.id);
                if (updated) {
                    setSelectedVoiceline(updated);
                } else {
                    // Jeśli wybrana linia została usunięta
                    setSelectedVoiceline(null);
                }
            }
        } catch (err) {
            console.error('Error fetching voice lines:', err);
            setError('Failed to load voice lines');
        } finally {
            setLoading(false);
        }
    }, [selectedVoiceline?.id]);

    // Pobieranie statusu schedulera
    const fetchSchedulerStatus = useCallback(async () => {
        try {
            const response = await api.get('/scheduler/status');
            setSchedulerStatus(response.data.is_running);
        } catch (err) {
            console.error('Error fetching scheduler status:', err);
        }
    }, []);

    // Efekt dla inicjalnego ładowania danych i ustawienia interwału odświeżania
    useEffect(() => {
        // Pierwsze pobranie danych
        fetchVoiceLines();
        fetchSchedulerStatus();
        
        // Ustawienie interwału odświeżania (co 5 sekund)
        const intervalId = setInterval(() => {
            fetchVoiceLines();
            fetchSchedulerStatus();
        }, 5000);
        
        // Czyszczenie interwału przy odmontowaniu komponentu
        return () => clearInterval(intervalId);
    }, [fetchVoiceLines, fetchSchedulerStatus]);

    // Obsługa wyboru linii głosowej
    const handleSelectVoiceline = (voiceline) => {
        setSelectedVoiceline(voiceline);
    };

    // Obsługa przełączania zaznaczenia w tabeli
    const handleToggleSelection = (id) => {
        setSelectedVoicelineIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(lineId => lineId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    // Czyszczenie zaznaczonych linii
    const handleClearSelection = () => {
        setSelectedVoicelineIds([]);
    };

    // Obsługa dodania nowej linii głosowej
    const handleVoiceLineAdded = (newVoiceLine) => {
        setVoicelines(prev => [...prev, newVoiceLine]);
        // Odświeżenie linii po dodaniu
        fetchVoiceLines();
    };

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <h1 className="mb-4 text-center">Voice Lines Management</h1>
                    
                    {/* Nawigacja zakładkowa */}
                    <ul className="nav nav-tabs mb-4">
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'voice-lines' ? 'active' : ''}`}
                                onClick={() => setActiveTab('voice-lines')}
                            >
                                <i className="bi bi-mic-fill me-2"></i>
                                Voice Lines
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <i className="bi bi-gear-fill me-2"></i>
                                Settings
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
            
            {/* Zawartość zakładki z ustawieniami */}
            {activeTab === 'settings' && <Settings />}
            
            {/* Zawartość zakładki z liniami głosowymi */}
            {activeTab === 'voice-lines' && (
                <>
                    {/* Kontrola schedulera */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <SchedulerControl 
                                schedulerStatus={schedulerStatus} 
                                onStatusChange={setSchedulerStatus} 
                            />
                        </div>
                    </div>
                    
                    {/* Wskaźnik ładowania */}
                    {loading && (
                        <div className="d-flex justify-content-center my-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    )}
                    
                    {/* Wyświetlanie błędów */}
                    {error && (
                        <div className="alert alert-danger" role="alert">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            {error}
                        </div>
                    )}
                    
                    {/* Formularz dodawania nowych linii głosowych */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <VoiceLineForm onVoiceLineAdded={handleVoiceLineAdded} />
                        </div>
                    </div>
                    
                    {/* Akcje grupowe */}
                    <div className="row mb-3">
                        <div className="col-12">
                            <BulkActions 
                                selectedIds={selectedVoicelineIds}
                                onActionComplete={fetchVoiceLines}
                                onClearSelection={handleClearSelection}
                            />
                        </div>
                    </div>
                    
                    {/* Lista linii głosowych i szczegóły wybranej linii */}
                    <div className="row">
                        {/* Lista dostępnych linii głosowych */}
                        <div className={`col-lg-7 mb-4 ${selectedVoiceline?.id ? '' : 'col-lg-12'}`}>
                            <VoiceLinesTable 
                                voicelines={voicelines}
                                selectedVoiceline={selectedVoiceline}
                                selectedIds={selectedVoicelineIds}
                                onSelect={handleSelectVoiceline}
                                onToggleSelection={handleToggleSelection}
                                onDataChange={fetchVoiceLines}
                            />
                        </div>
                        
                        {/* Szczegóły wybranej linii głosowej */}
                        {selectedVoiceline?.id && (
                            <div className="col-lg-5">
                                <VoiceLineDetails 
                                    voiceline={selectedVoiceline}
                                    onDataChange={fetchVoiceLines}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default App;