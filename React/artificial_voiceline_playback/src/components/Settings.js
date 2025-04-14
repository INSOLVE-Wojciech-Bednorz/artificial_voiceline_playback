import React, { useState, useEffect } from 'react';
import api from '../api';

const Settings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // --- Setting Groups State ---
    // State for individual settings categories
    const [voiceSettings, setVoiceSettings] = useState({});
    const [volumeSettings, setVolumeSettings] = useState({});
    const [radioSettings, setRadioSettings] = useState({});
    const [distortionSettings, setDistortionSettings] = useState({});

    // --- Data Fetching ---
    // Fetch settings from API
    const fetchSettings = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await api.get('/settings');
            const data = response.data;
            
            // Store complete settings
            setSettings(data);
            
            // Store individual categories for easier management
            setVoiceSettings(data.voice || {});
            setVolumeSettings(data.volumes || {});
            setRadioSettings(data.radio || {});
            setDistortionSettings(data.distortion_simulation || {});
            
        } catch (err) {
            console.error('Error fetching settings:', err);
            setError(err.response?.data?.detail || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    // --- Data Update ---
    // Update settings via API
    const updateSettings = async (updateData) => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            
            const response = await api.put('/settings', updateData);
            
            // Update state after successful update
            setSettings(response.data);
            
            // Update individual categories
            setVoiceSettings(response.data.voice || {});
            setVolumeSettings(response.data.volumes || {});
            setRadioSettings(response.data.radio || {});
            setDistortionSettings(response.data.distortion_simulation || {});
            
            setSuccess('Settings updated successfully');
        } catch (err) {
            console.error('Error updating settings:', err);
            setError(err.response?.data?.detail || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    // --- Voice Settings Handlers ---
    // Handle voice field changes
    const handleVoiceChange = (e) => {
        const { name, value } = e.target;
        setVoiceSettings(prev => ({
            ...prev,
            [name]: name === 'id' ? value : parseFloat(value)
        }));
    };

    // --- Volume Settings Handlers ---
    // Handle volume field changes
    const handleVolumeChange = (e) => {
        const { name, value } = e.target;
        setVolumeSettings(prev => ({
            ...prev,
            [name]: parseFloat(value)
        }));
    };

    // --- Compression Settings Handlers ---
    // Handle compression field changes
    const handleCompressionChange = (e) => {
        const { name, value } = e.target;
        setVolumeSettings(prev => ({
            ...prev,
            compression: {
                ...prev.compression,
                [name]: parseFloat(value)
            }
        }));
    };

    // --- Radio Settings Handlers ---
    // Handle radio settings changes
    const handleRadioChange = (e) => {
        const { name, value } = e.target;
        setRadioSettings(prev => ({
            ...prev,
            [name]: name === 'interval' ? parseInt(value) : value
        }));
    };

    // --- Distortion Settings Handlers ---
    // Handle distortion simulation changes
    const handleDistortionChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        setDistortionSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : 
                   ['sample_rate', 'filter_low', 'filter_high', 'bit_depth'].includes(name) ? 
                   parseInt(value) : parseFloat(value)
        }));
    };

    // --- Save Action Handlers ---
    // Save voice settings
    const saveVoiceSettings = async () => {
        await updateSettings({ voice: voiceSettings });
    };
    
    // Save volume settings
    const saveVolumeSettings = async () => {
        await updateSettings({ volumes: volumeSettings });
    };
    
    // Save radio settings
    const saveRadioSettings = async () => {
        await updateSettings({ radio: radioSettings });
    };
    
    // Save distortion simulation settings
    const saveDistortionSettings = async () => {
        await updateSettings({ distortion_simulation: distortionSettings });
    };
    
    // --- Initial Data Load ---
    // Load settings on first render
    useEffect(() => {
        fetchSettings();
    }, []);
    
    // --- Message Cleanup ---
    // Auto-hide success and error messages after timeout
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 5000);
            
            return () => clearTimeout(timer);
        }
    }, [success, error]);
    
    if (loading && !settings) {
        return (
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Settings</h5>
                </div>
                <div className="card-body d-flex justify-content-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !settings) {
        return (
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Settings</h5>
                </div>
                <div className="card-body">
                    <div className="alert alert-danger">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {error}
                        <div className="mt-2">
                            <button className="btn btn-sm btn-outline-dark" onClick={fetchSettings}>
                                <i className="bi bi-arrow-clockwise me-2"></i>
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-container">
            {/* Main success or error message */}
            {(success || error) && (
                <div className={`alert ${success ? 'alert-success' : 'alert-danger'} alert-dismissible fade show`}>
                    <i className={`bi ${success ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                    {success || error}
                    <button type="button" className="btn-close" onClick={() => {
                        setSuccess(null);
                        setError(null);
                    }}></button>
                </div>
            )}
            
            {/* Voice Settings Section */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light d-flex justify-content-between">
                    <h5 className="mb-0">Voice Settings</h5>
                </div>
                <div className="card-body">
                    <div className="row mb-3">
                        <div className="col-md-6">
                            <label className="form-label">Voice ID</label>
                            <input
                                type="text"
                                className="form-control"
                                name="id"
                                value={voiceSettings.id || ''}
                                onChange={handleVoiceChange}
                                placeholder="Voice ID from ElevenLabs"
                            />
                            <small className="form-text text-muted">
                                Get your voice ID from ElevenLabs dashboard
                            </small>
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Model</label>
                            <input
                                type="text"
                                className="form-control"
                                name="model"
                                value={voiceSettings.model || ''}
                                onChange={handleVoiceChange}
                                placeholder="e.g. eleven_multilingual_v2"
                            />
                        </div>
                    </div>
                    
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Stability: {voiceSettings.stability || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="stability"
                                min="0"
                                max="1"
                                step="0.01"
                                value={voiceSettings.stability || 0}
                                onChange={handleVoiceChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Similarity: {voiceSettings.similarity || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="similarity"
                                min="0"
                                max="1"
                                step="0.01"
                                value={voiceSettings.similarity || 0}
                                onChange={handleVoiceChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Style: {voiceSettings.style || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="style"
                                min="0"
                                max="1"
                                step="0.01"
                                value={voiceSettings.style || 0}
                                onChange={handleVoiceChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Speed: {voiceSettings.speed || 1}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="speed"
                                min="0.5"
                                max="2"
                                step="0.01"
                                value={voiceSettings.speed || 1}
                                onChange={handleVoiceChange}
                            />
                        </div>
                    </div>
                    
                    <div className="text-end">
                        <button
                            className="btn btn-primary"
                            onClick={saveVoiceSettings}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-save me-2"></i>
                                    Save Voice Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Volume Settings Section */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Volume Settings</h5>
                </div>
                <div className="card-body">
                    <div className="row mb-3">
                        <div className="col-md-3">
                            <label className="form-label">Master: {volumeSettings.master || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="master"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volumeSettings.master || 0}
                                onChange={handleVolumeChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Voice: {volumeSettings.voice || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="voice"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volumeSettings.voice || 0}
                                onChange={handleVolumeChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Radio: {volumeSettings.radio || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="radio"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volumeSettings.radio || 0}
                                onChange={handleVolumeChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Ducking: {volumeSettings.ducking || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="ducking"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volumeSettings.ducking || 0}
                                onChange={handleVolumeChange}
                            />
                        </div>
                    </div>
                    
                    <hr className="my-4" />
                    
                    <h6 className="mb-3">Compression Settings</h6>
                    <div className="row">
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Threshold: {volumeSettings.compression?.threshold || 0} dB</label>
                            <input
                                type="range"
                                className="form-range"
                                name="threshold"
                                min="-60"
                                max="0"
                                step="0.1"
                                value={volumeSettings.compression?.threshold || 0}
                                onChange={handleCompressionChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Ratio: {volumeSettings.compression?.ratio || 1}:1</label>
                            <input
                                type="range"
                                className="form-range"
                                name="ratio"
                                min="1"
                                max="20"
                                step="0.1"
                                value={volumeSettings.compression?.ratio || 1}
                                onChange={handleCompressionChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Attack: {volumeSettings.compression?.attack || 0} ms</label>
                            <input
                                type="range"
                                className="form-range"
                                name="attack"
                                min="0"
                                max="100"
                                step="1"
                                value={volumeSettings.compression?.attack || 0}
                                onChange={handleCompressionChange}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Release: {volumeSettings.compression?.release || 0} ms</label>
                            <input
                                type="range"
                                className="form-range"
                                name="release"
                                min="0"
                                max="500"
                                step="1"
                                value={volumeSettings.compression?.release || 0}
                                onChange={handleCompressionChange}
                            />
                        </div>
                    </div>
                    
                    <div className="text-end">
                        <button
                            className="btn btn-primary"
                            onClick={saveVolumeSettings}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-save me-2"></i>
                                    Save Volume Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Radio Settings Section */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Radio Settings</h5>
                </div>
                <div className="card-body">
                    <div className="row mb-3">
                        <div className="col-md-6">
                            <label className="form-label">Playlist Path</label>
                            <input
                                type="text"
                                className="form-control"
                                name="playlist"
                                value={radioSettings.playlist || ''}
                                onChange={handleRadioChange}
                                placeholder="Path to playlist file (.m3u, .pls)"
                            />
                            <small className="form-text text-muted">
                                Path to local M3U or PLS playlist file
                            </small>
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Interval (seconds)</label>
                            <input
                                type="number"
                                className="form-control"
                                name="interval"
                                min="1"
                                max="3600"
                                value={radioSettings.interval || 300}
                                onChange={handleRadioChange}
                            />
                            <small className="form-text text-muted">
                                Time between voice line playbacks (seconds)
                            </small>
                        </div>
                    </div>
                    
                    <div className="text-end">
                        <button
                            className="btn btn-primary"
                            onClick={saveRadioSettings}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-save me-2"></i>
                                    Save Radio Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Distortion Simulation Section */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">Distortion Simulation</h5>
                </div>
                <div className="card-body">
                    <div className="form-check mb-3">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            name="enabled"
                            checked={distortionSettings.enabled || false}
                            onChange={handleDistortionChange}
                            id="distortionEnabled"
                        />
                        <label className="form-check-label" htmlFor="distortionEnabled">
                            Enable Audio Distortion Simulation
                        </label>
                    </div>
                    
                    <div className={`row ${!distortionSettings.enabled && 'opacity-50'}`}>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Sample Rate: {distortionSettings.sample_rate || 32000} Hz</label>
                            <input
                                type="range"
                                className="form-range"
                                name="sample_rate"
                                min="8000"
                                max="44100"
                                step="100"
                                value={distortionSettings.sample_rate || 32000}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Bit Depth: {distortionSettings.bit_depth || 16} bits</label>
                            <select
                                className="form-select"
                                name="bit_depth"
                                value={distortionSettings.bit_depth || 16}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            >
                                <option value="8">8-bit</option>
                                <option value="12">12-bit</option>
                                <option value="16">16-bit</option>
                            </select>
                        </div>
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Distortion: {distortionSettings.distortion || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="distortion"
                                min="0"
                                max="0.01"
                                step="0.0001"
                                value={distortionSettings.distortion || 0}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                    </div>
                    
                    <div className={`row ${!distortionSettings.enabled && 'opacity-50'}`}>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Low Filter: {distortionSettings.filter_low || 0} Hz</label>
                            <input
                                type="range"
                                className="form-range"
                                name="filter_low"
                                min="0"
                                max="1000"
                                step="10"
                                value={distortionSettings.filter_low || 0}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">High Filter: {distortionSettings.filter_high || 4000} Hz</label>
                            <input
                                type="range"
                                className="form-range"
                                name="filter_high"
                                min="1000"
                                max="20000"
                                step="100"
                                value={distortionSettings.filter_high || 4000}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Noise: {distortionSettings.noise_level || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="noise_level"
                                min="0"
                                max="0.01"
                                step="0.0001"
                                value={distortionSettings.noise_level || 0}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                        <div className="col-md-3 mb-3">
                            <label className="form-label">Crackle: {distortionSettings.crackle || 0}</label>
                            <input
                                type="range"
                                className="form-range"
                                name="crackle"
                                min="0"
                                max="0.01"
                                step="0.0001"
                                value={distortionSettings.crackle || 0}
                                onChange={handleDistortionChange}
                                disabled={!distortionSettings.enabled}
                            />
                        </div>
                    </div>
                    
                    <div className="text-end">
                        <button
                            className="btn btn-primary"
                            onClick={saveDistortionSettings}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-save me-2"></i>
                                    Save Distortion Settings
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* ElevenLabs API Key Section */}
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-light">
                    <h5 className="mb-0">API Settings</h5>
                </div>
                <div className="card-body">
                    <div className="mb-3">
                        <label className="form-label">ElevenLabs API Key</label>
                        <div className="input-group">
                            <input
                                type="password"
                                className="form-control"
                                value={settings?.api_key || ''}
                                onChange={(e) => setSettings({...settings, api_key: e.target.value})}
                                placeholder="Enter your ElevenLabs API key"
                            />
                        </div>
                        <small className="form-text text-muted">
                            Get your API key from <a href="https://elevenlabs.io/docs/api-reference/authentication" target="_blank" rel="noreferrer">ElevenLabs</a>
                        </small>
                    </div>
                    
                    <div className="text-end">
                        <button
                            className="btn btn-primary"
                            onClick={() => updateSettings({ api_key: settings?.api_key })}
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-save me-2"></i>
                                    Save API Key
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;