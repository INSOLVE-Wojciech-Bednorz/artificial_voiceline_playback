import React, { useState } from 'react';
import api from '../api';

const VoiceLineForm = ({ onVoiceLineAdded }) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // --- Form Submission Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate input
        if (!text.trim()) {
            setError("Voice line text cannot be empty");
            return;
        }
        
        // Set loading state and reset messages
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            // Send API request to create new voice line
            const response = await api.post('/lines', { text });
            
            // Clear the form and show success message
            setText('');
            setSuccess("New voice line added successfully!");
            
            // Notify parent component
            if (onVoiceLineAdded) {
                onVoiceLineAdded(response.data);
            }
        } catch (err) {
            console.error('Error adding voice line:', err);
            setError(err.response?.data?.detail || "Failed to add voice line");
        } finally {
            setLoading(false);
        }
    };
    
    // --- Success Message Cleanup ---
    // Clear success message after timeout
    React.useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setSuccess(null);
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [success]);

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light">
                <h5 className="mb-0">Add New Voice Line</h5>
            </div>
            <div className="card-body">
                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="voiceLineText" className="form-label">Voice Line Text</label>
                        <textarea 
                            id="voiceLineText"
                            className="form-control" 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows="2"
                            placeholder="Enter the text for the new voice line..."
                            disabled={loading}
                        ></textarea>
                    </div>
                    
                    {error && (
                        <div className="alert alert-danger py-2 mb-3">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            {error}
                        </div>
                    )}
                    
                    {success && (
                        <div className="alert alert-success py-2 mb-3">
                            <i className="bi bi-check-circle-fill me-2"></i>
                            {success}
                        </div>
                    )}
                    
                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Creating...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-plus-circle me-2"></i>
                                Create Voice Line
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default VoiceLineForm;