import React, { useState, useEffect } from 'react';
import api from '../api';

const BulkActions = ({ selectedIds, onActionComplete, onClearSelection }) => {
    const [toggleLoading, setToggleLoading] = useState(false);
    const [toggleError, setToggleError] = useState(null);
    const [toggleSuccess, setToggleSuccess] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState(null);
    const [deleteSuccess, setDeleteSuccess] = useState(null);

    // --- Bulk Toggle Handler ---
    // Handle activating/deactivating multiple voice lines
    const handleBulkToggle = async (setActive = null) => {
        if (selectedIds.length === 0) {
            setToggleError("No voice lines selected");
            return;
        }
        
        setToggleLoading(true);
        setToggleError(null);
        setToggleSuccess(null);
        
        try {
            const response = await api.post('/lines/toggle', {
                ids: selectedIds,
                state: setActive
            });
            
            setToggleSuccess(response.data.message);
            
            // Notify parent of completed operation
            if (onActionComplete) {
                onActionComplete();
            }
            
            // Clear selections after successful operation
            if (onClearSelection) {
                onClearSelection();
            }
        } catch (err) {
            console.error('Error bulk toggling voice lines:', err);
            setToggleError(err.response?.data?.detail || "Failed to toggle voice lines");
        } finally {
            setToggleLoading(false);
        }
    };

    // --- Bulk Delete Handler ---
    // Handle deleting multiple voice lines
    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) {
            setDeleteError("No voice lines selected");
            return;
        }
        
        // Confirm deletion
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} voice lines? This action cannot be undone.`)) {
            return;
        }
        
        setDeleteLoading(true);
        setDeleteError(null);
        setDeleteSuccess(null);
        
        try {
            const response = await api.post('/lines/remove', {
                ids: selectedIds
            });
            
            setDeleteSuccess(response.data.message);
            
            // Notify parent of completed operation
            if (onActionComplete) {
                onActionComplete();
            }
            
            // Clear selections after successful operation
            if (onClearSelection) {
                onClearSelection();
            }
        } catch (err) {
            console.error('Error deleting voice lines:', err);
            setDeleteError(err.response?.data?.detail || "Failed to delete voice lines");
        } finally {
            setDeleteLoading(false);
        }
    };

    // --- Message Cleanup ---
    // Clear messages after timeout
    useEffect(() => {
        if (toggleSuccess || toggleError) {
            const timer = setTimeout(() => {
                setToggleSuccess(null);
                setToggleError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toggleSuccess, toggleError]);

    useEffect(() => {
        if (deleteSuccess || deleteError) {
            const timer = setTimeout(() => {
                setDeleteSuccess(null);
                setDeleteError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [deleteSuccess, deleteError]);

    return (
        <div className="card shadow-sm">
            <div className="card-body">
                <div className="d-flex justify-content-between align-items-center flex-wrap">
                    <div className="mb-2 mb-md-0">
                        <h5 className="mb-0">Bulk Actions</h5>
                        <small className="text-muted">
                            {selectedIds.length} voice lines selected
                        </small>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <button
                            className="btn btn-success"
                            onClick={() => handleBulkToggle(true)}
                            disabled={toggleLoading || selectedIds.length === 0 || deleteLoading}
                        >
                            <i className="bi bi-toggle-on me-2"></i>
                            Activate Selected
                        </button>
                        <button
                            className="btn btn-danger"
                            onClick={() => handleBulkToggle(false)}
                            disabled={toggleLoading || selectedIds.length === 0 || deleteLoading}
                        >
                            <i className="bi bi-toggle-off me-2"></i>
                            Deactivate Selected
                        </button>
                        <button
                            className="btn btn-outline-danger"
                            onClick={handleBulkDelete}
                            disabled={deleteLoading || selectedIds.length === 0}
                        >
                            {deleteLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-trash me-2"></i>
                                    Delete Selected
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                {/* Status messages for operations */}
                {toggleError && (
                    <div className="alert alert-danger py-2 mt-2 mb-0">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {toggleError}
                    </div>
                )}
                
                {toggleSuccess && (
                    <div className="alert alert-success py-2 mt-2 mb-0">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        {toggleSuccess}
                    </div>
                )}
                
                {deleteError && (
                    <div className="alert alert-danger py-2 mt-2 mb-0">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {deleteError}
                    </div>
                )}
                
                {deleteSuccess && (
                    <div className="alert alert-success py-2 mt-2 mb-0">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        {deleteSuccess}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkActions;