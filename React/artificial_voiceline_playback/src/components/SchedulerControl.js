import React from 'react';
import api from '../api';

const SchedulerControl = ({ schedulerStatus, onStatusChange }) => {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(null);

    // --- Scheduler Start Handler ---
    // Function to start the scheduler
    const handleStart = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            const response = await api.post('/scheduler/start');
            setSuccess(response.data.message);
            if (onStatusChange) {
                onStatusChange(true);
            }
        } catch (err) {
            console.error('Error starting scheduler:', err);
            setError(err.response?.data?.detail || 'Failed to start scheduler');
        } finally {
            setLoading(false);
        }
    };

    // --- Scheduler Stop Handler ---
    // Function to stop the scheduler
    const handleStop = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            const response = await api.post('/scheduler/stop');
            setSuccess(response.data.message);
            if (onStatusChange) {
                onStatusChange(false);
            }
        } catch (err) {
            console.error('Error stopping scheduler:', err);
            setError(err.response?.data?.detail || 'Failed to stop scheduler');
        } finally {
            setLoading(false);
        }
    };

    // --- Message Cleanup ---
    // Clear messages after timeout
    React.useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Scheduler Control</h5>
                <span className={`badge ${schedulerStatus ? 'bg-success' : 'bg-secondary'}`}>
                    {schedulerStatus ? 'Running' : 'Stopped'}
                </span>
            </div>
            <div className="card-body">
                <p className="card-text">
                    The scheduler randomly plays active voice lines at the configured interval, 
                    handling radio playback and ducking. Requires VLC to be available.
                </p>
                
                <div className="d-flex gap-3">
                    <button 
                        className="btn btn-success" 
                        onClick={handleStart}
                        disabled={loading || schedulerStatus}
                    >
                        {loading && !schedulerStatus ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Starting...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-play-fill me-2"></i>
                                Start Scheduler
                            </>
                        )}
                    </button>
                    
                    <button 
                        className="btn btn-danger" 
                        onClick={handleStop}
                        disabled={loading || !schedulerStatus}
                    >
                        {loading && schedulerStatus ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Stopping...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-stop-fill me-2"></i>
                                Stop Scheduler
                            </>
                        )}
                    </button>
                </div>
                
                {error && (
                    <div className="alert alert-danger mt-3">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {error}
                    </div>
                )}
                
                {success && (
                    <div className="alert alert-success mt-3">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        {success}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchedulerControl;