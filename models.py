# models.py
from pydantic import BaseModel, Field, FilePath, HttpUrl, ConfigDict
from typing import List, Optional, Dict, Any

# --- Voice Line Models ---

class VoiceLineBase(BaseModel):
    """Base model for voice line data."""
    text: str = Field(..., description="The text content of the voice line.", min_length=1, example="This is a sample voice line text.")
    active: bool = Field(..., description="Whether the voice line is active in the scheduler.", example=True)

class VoiceLine(VoiceLineBase):
    """Model representing a voice line as stored and returned by the API."""
    id: int = Field(..., description="Unique identifier for the voice line.", example=1)
    filename: str = Field(..., description="The name of the associated audio file.", example="line_1.mp3")

    # Add an example for the whole model in Swagger UI
    model_config = ConfigDict(
        json_schema_extra = {
            "example": {
                "id": 42,
                "text": "Zapraszamy do dzia\u0142u owoc\u00f3w i warzyw! S\u0142odkie pomara\u0144cze w cenie 3,99 z\u0142 za kilogram. Doskona\u0142e na sok!",
                "filename": "line_42.mp3",
                "active": True
            }
        }
    )


class NewLineRequest(BaseModel):
    """Request model for adding a new voice line."""
    text: str = Field(..., description="The text for the new voice line.", min_length=1, example="Please proceed to the nearest exit.")

class EditLineRequest(BaseModel):
    """Request model for editing an existing voice line."""
    new_text: str = Field(..., description="The updated text for the voice line.", min_length=1, example="Emergency alert: Evacuate immediately.")

class IdListRequest(BaseModel):
    """Request model for operations requiring a list of line IDs."""
    ids: List[int] = Field(..., description="A list of voice line IDs to target.", example=[1, 3, 5])

class ToggleSpecificRequest(IdListRequest):
    """Request model for toggling the active state of specific lines."""
    # Optional state: if None, toggle; if True/False, set explicitly.
    state: Optional[bool] = Field(None, description="Optional target state (true=active, false=inactive). If omitted, the state is toggled.", example=False)

class ToggleAllRequest(BaseModel):
    """Request model for toggling the active state of ALL lines."""
    state: bool = Field(..., description="Target state for all lines (true=active, false=inactive).", example=False)


# --- Settings Models ---
# Added examples to fields for better Swagger UI documentation

class VoiceSettings(BaseModel):
    """Model for ElevenLabs voice settings."""
    id: str = Field(..., description="ElevenLabs Voice ID.", example="NacdHGUYR1k3M0FAbAia")
    model: str = Field("eleven_multilingual_v2", description="ElevenLabs model ID.", example="eleven_multilingual_v2")
    stability: float = Field(..., ge=0.0, le=1.0, description="Voice stability setting (0.0 to 1.0).", example=0.8)
    similarity: float = Field(..., ge=0.0, le=1.0, description="Voice similarity boost setting (0.0 to 1.0).", example=0.9)
    style: float = Field(..., ge=0.0, le=1.0, description="Voice style exaggeration setting (0.0 to 1.0).", example=0.3)
    speed: float = Field(..., ge=0.5, le=2.0, description="Voice speed setting (0.5 to 2.0).", example=0.7)

class CompressionSettings(BaseModel):
    """Model for dynamic range compression settings."""
    threshold: float = Field(..., description="Compression threshold in dBFS (e.g., -20.0).", example=-20.0)
    ratio: float = Field(..., gt=1.0, description="Compression ratio (e.g., 4.0 for 4:1).", example=4.0)
    attack: float = Field(..., gt=0.0, description="Attack time in milliseconds (e.g., 5.0).", example=5.0)
    release: float = Field(..., gt=0.0, description="Release time in milliseconds (e.g., 50.0).", example=50.0)

class VolumeSettings(BaseModel):
    """Model for various volume level settings."""
    master: float = Field(..., ge=0.0, le=2.0, description="Master output volume multiplier (0.0 to 2.0).", example=1.0)
    radio: float = Field(..., ge=0.0, le=1.0, description="Radio stream volume (0.0 to 1.0).", example=0.2)
    ducking: float = Field(..., ge=0.0, le=1.0, description="Radio volume when voice line plays (0.0 to 1.0).", example=0.0)
    voice: float = Field(..., ge=0.0, le=2.0, description="Voice line volume multiplier (0.0 to 2.0).", example=0.3)
    compression: CompressionSettings = Field(..., description="Dynamic range compression settings.")

class RadioSettings(BaseModel):
    """Model for radio settings."""
    playlist: Optional[str] = Field(None, description="Path to the M3U or PLS playlist file (can be empty or null).", example="RMF_FM.pls")
    interval: float = Field(..., gt=0, description="Interval between voice lines in seconds (e.g., 300 for 5 minutes).", example=30.0)

class DistortionSettings(BaseModel):
    """Model for audio distortion/degradation simulation settings."""
    enabled: bool = Field(..., description="Enable/disable distortion effects.", example=False)
    sample_rate: int = Field(..., ge=8000, le=48000, description="Target sample rate for downsampling effect (Hz).", example=32000)
    distortion: float = Field(..., ge=0.0, le=1.0, description="Amount of non-linear distortion/clipping (0.0 to 1.0).", example=0.0002)
    filter_low: int = Field(..., ge=20, le=5000, description="High-pass filter cutoff frequency (Hz).", example=200) # Adjusted max based on common use
    filter_high: int = Field(..., ge=100, le=20000, description="Low-pass filter cutoff frequency (Hz).", example=4000) # Adjusted max
    noise_level: float = Field(..., ge=0.0, le=0.5, description="Amount of added noise (0.0 to 0.5).", example=0.0001)
    bit_depth: int = Field(..., ge=4, le=16, description="Target bit depth for bitcrushing effect (4-16 bits).", example=16)
    crackle: float = Field(..., ge=0.0, le=0.5, description="Intensity of simulated crackle effect (0.0 to 0.5).", example=0.0002)

class AppSettings(BaseModel):
    """Model representing the complete application settings."""
    api_key: str = Field(..., description="ElevenLabs API Key (sensitive, consider environment variables).", example="sk_...")
    voice: VoiceSettings
    volumes: VolumeSettings
    radio: RadioSettings
    distortion_simulation: DistortionSettings # Only one section now

    # Add an example for the whole settings structure
    model_config = ConfigDict(
         json_schema_extra = {
            "example": {
                "api_key": "sk_c3080639f3d803a0e690bbef0d8d85a238fab2e1e6b4a9fd",
                "voice": {
                    "id": "NacdHGUYR1k3M0FAbAia", "model": "eleven_multilingual_v2", "stability": 0.8,
                    "similarity": 0.9, "style": 0.3, "speed": 0.7
                },
                "volumes": {
                    "master": 1.0, "radio": 0.2, "ducking": 0.0, "voice": 0.3,
                    "compression": {"threshold": -20.0, "ratio": 4.0, "attack": 5.0, "release": 50.0}
                },
                "radio": {"playlist": "RMF_FM.pls", "interval": 30.0},
                "distortion_simulation": {
                    "enabled": False, "sample_rate": 32000, "distortion": 0.0002, "filter_low": 200,
                    "filter_high": 4000, "noise_level": 0.0001, "bit_depth": 16, "crackle": 0.0002
                }
            }
        }
    )


class SettingsUpdateRequest(BaseModel):
    """Model for updating settings. All fields are optional. Provide only the sections you want to modify."""
    api_key: Optional[str] = Field(None, description="New ElevenLabs API Key.", example="sk_...")
    voice: Optional[VoiceSettings] = Field(None, description="Updated voice settings.")
    volumes: Optional[VolumeSettings] = Field(None, description="Updated volume settings.")
    radio: Optional[RadioSettings] = Field(None, description="Updated radio settings.")
    distortion_simulation: Optional[DistortionSettings] = Field(None, description="Updated distortion settings.")

    # Add an example for partial update
    model_config = ConfigDict(
         json_schema_extra = {
             "example": {
                 "volumes": {
                    "master": 0.9, "radio": 0.25, "ducking": 0.05, "voice": 0.35,
                    "compression": {"threshold": -18.0, "ratio": 5.0, "attack": 4.0, "release": 60.0}
                 },
                 "radio": {"interval": 60.0}
             }
         }
     )


# --- General API Response Models ---

class StatusResponse(BaseModel):
    """Generic response model for status messages."""
    status: str = Field(..., example="success")
    message: Optional[str] = Field(None, example="Operation completed successfully.")

class ErrorDetail(BaseModel):
    """Standard error detail model."""
    detail: str = Field(..., example="Specific error message describing the issue.")

# Example for ErrorDetail
ErrorResponseExample = ErrorDetail(detail="Voice line with ID 999 not found.")


class ToggleResponse(BaseModel):
    """Response model for toggle operations."""
    changed_count: int = Field(..., description="Number of lines whose state was changed.", example=3)
    message: str = Field(..., example="Successfully activated 3 lines.")

class RemoveResponse(BaseModel):
    """Response model for remove operations."""
    removed_count: int = Field(..., description="Number of lines successfully removed.", example=2)
    removed_ids: List[int] = Field(..., description="List of the original IDs of the removed lines.", example=[2, 4])
    message: str = Field(..., example="Successfully removed 2 lines. Lines have been re-indexed.")

class SchedulerStatusResponse(BaseModel):
    """Response model for scheduler status."""
    is_running: bool = Field(..., description="True if the scheduler background task is active, False otherwise.", example=True)

