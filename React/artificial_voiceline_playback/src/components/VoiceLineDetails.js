import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const VoiceLineDetails = ({ voiceline, onDataChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);
    const [editSuccess, setEditSuccess] = useState(null);
    const [toggleLoading, setToggleLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [previousId, setPreviousId] = useState(null);
    
    // Reference to the text input field
    const textareaRef = useRef(null);
    
    // --- State Reset Logic ---
    // Reset editing state only when the selected line changes
    useEffect(() => {
        if (voiceline && voiceline.id !== previousId) {
            setIsEditing(false);
            setEditText('');
            setEditError(null);
            setEditSuccess(null);
            setAudioError(null);
            setPreviousId(voiceline.id);
        } else if (voiceline && isEditing) {
            // Preserve the edit text, but only update if ID hasn't changed
            setEditText(prev => prev || voiceline.text);
        }
    }, [voiceline, previousId, isEditing]);
    
    // --- Focus Management ---
    // Restore focus after refresh if editing mode is enabled
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            // Save cursor position
            const savedStart = textareaRef.current.selectionStart;
            const savedEnd = textareaRef.current.selectionEnd;
            
            // Restore focus
            textareaRef.current.focus();
            
            // Restore cursor position if it was saved
            if (savedStart !== undefined && savedEnd !== undefined) {
                setTimeout(() => {
                    try {
                        textareaRef.current.setSelectionRange(savedStart, savedEnd);
                    } catch (e) {
                        console.error("Couldn't restore cursor position:", e);
                    }
                }, 0);
            }
        }
    }, [voiceline, isEditing]);
    
    // --- Success Message Cleanup ---
    // Clear success messages after a timeout
    useEffect(() => {
        if (editSuccess) {
            const timer = setTimeout(() => {
                setEditSuccess(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [editSuccess]);
    
    // --- Editing Handlers ---
    // Start editing mode
    const handleStartEdit = () => {
        setEditText(voiceline.text);
        setIsEditing(true);
        setEditError(null);
    };
    
    // Cancel editing
    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditError(null);
    };
    
    // Save changes
    const handleSubmitEdit = async () => {
        if (!editText.trim()) {
            setEditError("Voice line text cannot be empty");
            return;
        }

        setEditLoading(true);
        setEditError(null);
        setEditSuccess(null);

        try {
            await api.put(`/lines/${voiceline.id}`, {
                new_text: editText
            });
            
            setEditSuccess("Voice line updated successfully!");
            setIsEditing(false);
            
            // Notify parent of data change
            if (onDataChange) {
                onDataChange();
            }
        } catch (err) {
            console.error('Error updating voice line:', err);
            setEditError(err.response?.data?.detail || "Failed to update voice line");
        } finally {
            setEditLoading(false);
        }
    };
    
    // --- Active State Management ---
    // Toggle active/inactive state
    const handleToggleActive = async () => {
        setToggleLoading(true);
        
        try {
            await api.post('/lines/toggle', {
                ids: [voiceline.id]
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
    // Delete voice line
    const handleDelete = async () => {
        // Confirm deletion
        if (!window.confirm('Are you sure you want to delete this voice line? This action cannot be undone.')) {
            return;
        }
        
        setDeleteLoading(true);
        
        try {
            await api.post('/lines/remove', {
                ids: [voiceline.id]
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
    
    // --- Audio Error Handling ---
    // Handle audio element load errors
    const handleAudioError = (event) => {
        console.error("Audio file failed to load:", event);
        setAudioError("Audio file missing or corrupted");
    };
    
    // Return null if no voice line selected
    if (!voiceline?.id) {
        return null;
    }

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light">
                <h5 className="mb-0">Selected Voice Line</h5>
            </div>
            <div className="card-body">
                <h6 className="card-subtitle mb-2 text-muted">ID: {voiceline.id}</h6>
                
                {isEditing ? (
                    <div className="mb-3">
                        <label className="form-label">Edit Voice Line Text:</label>
                        <textarea 
                            className="form-control mb-2"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows="3"
                            ref={textareaRef}
                        />
                        
                        {editError && (
                            <div className="alert alert-danger py-2 mb-2">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                {editError}
                            </div>
                        )}
                        
                        <div className="d-flex gap-2">
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmitEdit}
                                disabled={editLoading}
                            >
                                {editLoading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Saving...
                                    </>
                                ) : "Save Changes"}
                            </button>
                            <button 
                                className="btn btn-outline-secondary" 
                                onClick={handleCancelEdit}
                                disabled={editLoading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="card-text">{voiceline.text}</p>
                        <div className="d-flex gap-2 mb-3 flex-wrap">
                            <button 
                                className="btn btn-outline-primary"
                                onClick={handleStartEdit}
                                disabled={deleteLoading}
                            >
                                <i className="bi bi-pencil me-2"></i>
                                Edit Text
                            </button>
                            <button 
                                className={`btn ${voiceline.active ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                onClick={handleToggleActive}
                                disabled={toggleLoading || deleteLoading}
                            >
                                <i className={`bi me-2 ${voiceline.active ? 'bi-toggle-off' : 'bi-toggle-on'}`}></i>
                                {voiceline.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button 
                                className="btn btn-outline-danger"
                                onClick={handleDelete}
                                disabled={deleteLoading}
                            >
                                <i className="bi bi-trash me-2"></i>
                                Delete
                            </button>
                        </div>
                        
                        {editSuccess && (
                            <div className="alert alert-success py-2 mb-3">
                                <i className="bi bi-check-circle-fill me-2"></i>
                                {editSuccess}
                            </div>
                        )}
                    </>
                )}
                
                <div className="d-flex align-items-center mb-3">
                    <span className="me-2">Status:</span>
                    <span className={`badge ${voiceline.active ? 'bg-success' : 'bg-danger'}`}>
                        {voiceline.active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                
                {voiceline.filename ? (
                    <div className="card-footer bg-white p-0 border-top">
                        <div className="mt-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <label className="form-label mb-0">Preview Audio:</label>
                            </div>
                            
                            {audioError && (
                                <div className="alert alert-warning py-2 mb-2">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    {audioError}
                                </div>
                            )}
                            
                            <audio 
                                controls 
                                src={`http://localhost:8060/audio/${voiceline.filename}`}
                                className="w-100"
                                onError={handleAudioError}
                            >
                                Your browser does not support the audio element
                            </audio>
                        </div>
                    </div>
                ) : (
                    <div className="card-footer bg-white p-3 border-top">
                        <div className="text-center text-muted">
                            <i className="bi bi-file-earmark-music me-2"></i>
                            No audio file available
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceLineDetails;