import React from 'react';
import api from '../api';

const VoiceLinesTable = ({ 
    voicelines, 
    selectedVoiceline, 
    selectedIds,
    onSelect,
    onToggleSelection,
    onDataChange 
}) => {
    const [toggleLoading, setToggleLoading] = React.useState(false);
    const [deleteLoading, setDeleteLoading] = React.useState(false);

    // --- Single Line Actions ---
    // Handle toggling active state of a single voice line
    const handleToggleActive = async (id, e) => {
        e.stopPropagation();
        setToggleLoading(true);
        
        try {
            await api.post('/lines/toggle', {
                ids: [id]
            });
            
            // Notify parent of data change
            if (onDataChange) {
                onDataChange();
            }
        } catch (err) {
            console.error('Error toggling voice line:', err);
        } finally {
            setToggleLoading(false);
        }
    };

    // --- Deletion Handler ---
    // Handle deleting a single voice line
    const handleDelete = async (id, e) => {
        e.stopPropagation();
        
        // Confirm deletion
        if (!window.confirm('Are you sure you want to delete this voice line? This action cannot be undone.')) {
            return;
        }
        
        setDeleteLoading(true);
        
        try {
            await api.post('/lines/remove', {
                ids: [id]
            });
            
            // Notify parent of data change
            if (onDataChange) {
                onDataChange();
            }
        } catch (err) {
            console.error('Error deleting voice line:', err);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light">
                <h5 className="mb-0">Available Voice Lines</h5>
            </div>
            <div className="list-group list-group-flush">
                {voicelines.length === 0 ? (
                    <div className="list-group-item text-center text-muted py-4">
                        <i className="bi bi-mic-mute me-2"></i>
                        No voice lines available
                    </div>
                ) : (
                    voicelines.map((voiceline) => (
                        <div
                            key={voiceline.id}
                            className={`list-group-item ${
                                selectedVoiceline?.id === voiceline.id ? 'active' : ''
                            }`}
                        >
                            <div className="d-flex flex-column flex-md-row">
                                {/* Checkbox and line ID */}
                                <div className="d-flex align-items-start align-items-md-center mb-2 mb-md-0">
                                    <div className="me-2">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={selectedIds.includes(voiceline.id)}
                                            onChange={() => onToggleSelection && onToggleSelection(voiceline.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <span className="badge bg-secondary me-3">#{voiceline.id}</span>
                                </div>
                                
                                {/* Voice line text content */}
                                <div className="voice-line-content mb-2 mb-md-0 me-md-3">
                                    <button
                                        type="button"
                                        className={`btn btn-link text-decoration-none p-0 text-start w-100 ${
                                            selectedVoiceline?.id === voiceline.id ? 'text-white' : 'text-dark'
                                        }`}
                                        onClick={() => onSelect && onSelect(voiceline)}
                                    >
                                        <span className="voice-line-text">{voiceline.text}</span>
                                    </button>
                                </div>
                                
                                {/* Status, toggle and delete buttons */}
                                <div className="d-flex align-items-center ms-md-auto mt-2 mt-md-0">
                                    <span className={`badge me-2 ${voiceline.active ? 'bg-success' : 'bg-danger'}`}>
                                        {voiceline.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <button
                                        className={`btn btn-sm ${voiceline.active ? 'btn-outline-danger' : 'btn-outline-success'} me-2`}
                                        onClick={(e) => handleToggleActive(voiceline.id, e)}
                                        disabled={toggleLoading}
                                        title={voiceline.active ? "Deactivate" : "Activate"}
                                    >
                                        <i className={`bi ${voiceline.active ? 'bi-toggle-off' : 'bi-toggle-on'}`}></i>
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={(e) => handleDelete(voiceline.id, e)}
                                        disabled={deleteLoading}
                                        title="Delete"
                                    >
                                        <i className="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default VoiceLinesTable;