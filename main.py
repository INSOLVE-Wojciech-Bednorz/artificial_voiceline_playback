# main.py
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure the voice_system module can be found
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, HTTPException, Body, status, Depends, Path as F_path
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Dict, Any

# Import models and the core voice system logic
import models
from voice_system import VoiceSystem, DEFAULT_CONFIG, _get_nested_value, AUDIO_DIR

from fastapi.staticfiles import StaticFiles
# Import StaticFiles to serve static content (CSS, JS, images) via HTTP endpoints in FastAPI

HOST_IP_ORIGIN = "localhost"


# --- Logging Setup ---
# Use the logger configured in voice_system.py
logger = logging.getLogger("voice_system") # Or use __name__ for FastAPI specific logs

# --- Global Voice System Instance ---
voice_system_instance = VoiceSystem()

# --- FastAPI Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Voice System API...")
    logger.info(f"Initial config loaded for voice ID: {_get_nested_value(voice_system_instance.config, ['voice', 'id'], 'N/A')}")
    logger.info(f"Found {len(voice_system_instance.lines)} voice lines.")
    yield
    # Shutdown
    logger.info("Shutting down Voice System API...")
    voice_system_instance.cleanup()
    logger.info("Cleanup complete.")


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Voice Line & Radio Manager API",
    description="API for managing voice lines, radio playback, and associated settings. Uses Pydantic models with examples.",
    version="1.1.0", # Incremented version
    lifespan=lifespan
)

# --- Dependency ---
async def get_voice_system():
    # Could add checks here if needed (e.g., ensure instance is initialized)
    if not voice_system_instance:
         raise HTTPException(status_code=503, detail="Voice system is not available.")
    return voice_system_instance

# --- Custom Exception Handler for Validation Errors ---
# Optional: Catch Pydantic validation errors globally for consistent 422 response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse

app.mount("/audio", StaticFiles(directory=Path("audio_files")), name="audio")
# Mount a static file server at the "/audio" endpoint, serving files from the "audio_files" directory

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    # Log the detailed validation error
    logger.warning(f"Request validation error: {exc.errors()}")
    # Return a user-friendly message (or customize based on exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": f"Invalid request data. Please check the API documentation. Errors: {exc.errors()}"},
    )


# --- API Endpoints ---

# -- Voice Lines --

@app.get(
    "/lines",
    response_model=List[models.VoiceLine],
    summary="List All Voice Lines",
    tags=["Voice Lines"]
)
async def get_all_lines(vs: VoiceSystem = Depends(get_voice_system)):
    """Retrieves a list of all configured voice lines, sorted by ID."""
    return vs.get_lines() # Already sorted by ID in _save_lines

@app.get(
    "/lines/{line_id}/audiofile",
    response_class=FileResponse,
    summary="Get Audio File for a Specific Voice Line",
    tags=["Voice Lines"],
    responses={
        200: {
            "content": {"audio/mpeg": {}},
            "description": "The audio file for the specified line ID.",
        },
        404: {"model": models.ErrorDetail, "description": "Line or audio file not found"},
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def get_line_audio_file(
    line_id: int = F_path(..., description="The ID of the line for which to retrieve the audio file.", ge=1),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Retrieves the raw MP3 audio file for a specific voice line, identified by its `line_id`.
    This allows direct playback or download of the audio file.
    """
    if line_id <= 0:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Line ID must be a positive integer.")

    line = vs.get_line_by_id(line_id)
    if not line:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Voice line with ID {line_id} not found.")

    filename = line.get('filename')
    if not filename:
        logger.error(f"Line ID {line_id} found, but has no associated filename.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Audio filename missing for line ID {line_id}.")

    file_path = AUDIO_DIR / filename
    if not file_path.is_file():
        logger.error(f"Audio file '{filename}' for line ID {line_id} not found at path: {file_path}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Audio file for line ID {line_id} not found on server.")

    try:
        return FileResponse(path=file_path, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error serving audio file {file_path} for line ID {line_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Could not serve audio file: {str(e)}")


@app.post(
    "/lines",
    response_model=models.VoiceLine,
    status_code=status.HTTP_201_CREATED,
    summary="Add a New Voice Line",
    tags=["Voice Lines"],
    responses={
        400: {"model": models.ErrorDetail, "description": "Bad Request (e.g., API key missing, generation failed)"},
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def add_new_line(
    request: models.NewLineRequest,
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Adds a new voice line. Requires the text content.
    Generates the speech audio file via ElevenLabs API.
    Returns the newly created voice line object including its ID.
    """
    new_line, error = vs.add_line(request.text)
    if error:
        # Determine if it's a client error (400) or server error (500)
        if "API Key" in error or "ID głosu" in error:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
        elif "API ElevenLabs" in error or "Błąd połączenia" in error:
             # Treat API errors as potentially transient server-side issues or config issues
             raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ElevenLabs API Error: {error}")
        elif "Błąd zapisu pliku" in error:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error)
        else: # Other generation errors
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    if not new_line: # Should not happen if error is None, but check anyway
         logger.error("add_line returned no error but also no line object.")
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add line due to an unexpected internal error.")
    return new_line

@app.put(
    "/lines/{line_id}",
    response_model=models.VoiceLine,
    summary="Edit a Voice Line",
    tags=["Voice Lines"],
    responses={
        404: {"model": models.ErrorDetail, "description": "Line not found"},
        400: {"model": models.ErrorDetail, "description": "Bad Request (e.g., generation failed)"},
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def edit_existing_line(
    line_id: int = F_path(..., description="The ID of the line to edit.", ge=1),
    request: models.EditLineRequest = Body(...),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Edits the text of an existing voice line identified by its `line_id`.
    Regenerates the speech audio file.
    Returns the updated voice line object.
    """
    if line_id <= 0:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Line ID must be a positive integer.")

    updated_line, error = vs.edit_line(line_id, request.new_text)
    if error:
        if "Nie znaleziono linii" in error:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error)
        # Handle other potential errors from edit_line (similar to add_line)
        elif "API Key" in error or "ID głosu" in error:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
        elif "API ElevenLabs" in error or "Błąd połączenia" in error:
             raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"ElevenLabs API Error: {error}")
        elif "Błąd zapisu pliku" in error:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=error)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    if not updated_line:
         logger.error(f"edit_line for ID {line_id} returned no error but no line object.")
         raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to edit line due to an unexpected internal error.")
    return updated_line

@app.post(
    "/lines/toggle",
    response_model=models.ToggleResponse,
    summary="Toggle Active State of Specific Lines",
    tags=["Voice Lines"],
    responses={
        400: {"model": models.ErrorDetail, "description": "Bad Request (e.g., empty ID list)"},
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def toggle_specific_lines(
    request: models.ToggleSpecificRequest = Body(...),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Toggles or sets the active state for a specific list of voice line IDs.
    Provide a list of integer IDs in the `ids` field.
    Optionally provide a boolean `state` to set explicitly (true=active, false=inactive),
    otherwise the state for each specified line is flipped.
    Returns the count of lines whose state was actually changed.
    """
    if not request.ids:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The list of line IDs cannot be empty.")

    try:
        changed_count, ids_changed = vs.bulk_toggle_sync(request.ids, request.state)

        state_desc = "toggled"
        if request.state is True:
            state_desc = "activated"
        elif request.state is False:
            state_desc = "deactivated"

        # Check if any requested IDs were not found (logged in voice_system, maybe add info here?)
        message = f"Successfully {state_desc} {changed_count} lines."
        # Add info about not found IDs if necessary based on logs or return value changes

        return models.ToggleResponse(
            changed_count=changed_count,
            message=message
        )
    except Exception as e:
        logger.error(f"Error toggling specific lines: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred: {str(e)}")

@app.post(
    "/lines/toggle-all",
    response_model=models.ToggleResponse,
    summary="Toggle Active State of ALL Lines",
    tags=["Voice Lines"],
     responses={
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def toggle_all_active_state(
    request: models.ToggleAllRequest = Body(...),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Sets the active state for ALL existing voice lines.
    Requires the target boolean `state` (true=active, false=inactive).
    Returns the count of lines whose state was actually changed.
    """
    try:
        changed_count = vs.toggle_all_lines(request.state)
        state_desc = "activated" if request.state else "deactivated"
        return models.ToggleResponse(
            changed_count=changed_count,
            message=f"Successfully set all lines to {state_desc}. {changed_count} lines were changed."
        )
    except Exception as e:
        logger.error(f"Error toggling all lines: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred: {str(e)}")


@app.post(
    "/lines/remove",
    response_model=models.RemoveResponse,
    summary="Remove Specific Voice Lines",
    tags=["Voice Lines"],
     responses={
        400: {"model": models.ErrorDetail, "description": "Bad Request (e.g., empty ID list)"},
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def remove_specific_lines(
    request: models.IdListRequest = Body(...),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Removes specific voice lines and their associated audio files, identified by a list of IDs.
    Lines are re-indexed after removal.
    Returns the count of removed lines and their original IDs.
    """
    if not request.ids:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The list of line IDs cannot be empty.")

    try:
        removed_count, removed_ids = vs.remove_lines_sync(request.ids)

        message=f"Successfully removed {removed_count} lines."
        if removed_count > 0:
             message += " Lines have been re-indexed."
        # Add info about not found IDs if necessary

        return models.RemoveResponse(
            removed_count=removed_count,
            removed_ids=removed_ids,
            message=message
        )
    except Exception as e:
        logger.error(f"Error removing specific lines: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred: {str(e)}")

@app.post(
    "/lines/remove-all",
    response_model=models.RemoveResponse,
    summary="Remove ALL Voice Lines",
    tags=["Voice Lines"],
    responses={
        500: {"model": models.ErrorDetail, "description": "Internal Server Error"}
    }
)
async def remove_all_existing_lines(vs: VoiceSystem = Depends(get_voice_system)):
    """
    Removes ALL existing voice lines and their associated audio files.
    Use with caution!
    Returns the count of removed lines and their original IDs.
    """
    try:
        removed_count, removed_ids = vs.remove_all_lines()
        return models.RemoveResponse(
            removed_count=removed_count,
            removed_ids=removed_ids,
            message=f"Successfully removed all {removed_count} lines."
        )
    except Exception as e:
        logger.error(f"Error removing all lines: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred: {str(e)}")


# -- Scheduler Control --

@app.post(
    "/scheduler/start",
    response_model=models.StatusResponse,
    summary="Start the Scheduler",
    tags=["Scheduler"],
    responses={
        409: {"model": models.ErrorDetail, "description": "Scheduler already running"},
        500: {"model": models.ErrorDetail, "description": "Failed to start scheduler or radio"},
        503: {"model": models.ErrorDetail, "description": "VLC service unavailable"}
    }
)
async def start_scheduler_playback(vs: VoiceSystem = Depends(get_voice_system)):
    """
    Starts the background scheduler thread.
    The scheduler randomly plays active voice lines at the configured interval,
    handling radio playback and ducking. Requires VLC to be available.
    """
    if not vs._vlc_instance: # Check if VLC initialized correctly
         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cannot start scheduler: VLC is not available.")

    success, message = vs.start_scheduler()
    if not success:
        if "Scheduler już działa" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
        elif "Nie udało się uruchomić wątku" in message:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)
        elif "radio failed to start" in message or "brak URL strumienia" in message: # Check message from radio start failure inside scheduler start
             # Report radio failure but maybe scheduler thread itself started? Check status?
             # Let's treat radio failure as a 500 for starting the *service*
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Scheduler started, but radio failed: {message}")
        else: # Generic failure
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)

    return models.StatusResponse(status="success", message=message)

@app.post(
    "/scheduler/stop",
    response_model=models.StatusResponse,
    summary="Stop the Scheduler",
    tags=["Scheduler"],
    responses={
        200: {"model": models.StatusResponse, "description": "Scheduler stopped successfully or was already stopped"},
        500: {"model": models.ErrorDetail, "description": "Error stopping scheduler or radio"}
    }
)
async def stop_scheduler_playback(vs: VoiceSystem = Depends(get_voice_system)):
    """
    Stops the background scheduler thread and the radio stream.
    Returns success even if the scheduler was already stopped.
    """
    success, message = vs.stop_scheduler()
    if not success:
         # Distinguish between timeout and other errors
         if "nie zatrzymał się w wyznaczonym czasie" in message:
              # Logged as warning in voice_system, return 500 here
              raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)
         else: # Other internal errors during stop
              raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)

    # If success is True, it means it stopped or was already stopped.
    return models.StatusResponse(status="success", message=message)


@app.get(
    "/scheduler/status",
    response_model=models.SchedulerStatusResponse,
    summary="Get Scheduler Status",
    tags=["Scheduler"]
)
async def get_scheduler_running_status(vs: VoiceSystem = Depends(get_voice_system)):
    """
    Checks if the background scheduler thread is currently running.
    """
    is_running = vs.get_scheduler_status()
    return models.SchedulerStatusResponse(is_running=is_running)


# -- Settings --

@app.get(
    "/settings",
    response_model=models.AppSettings,
    summary="Get All Settings",
    tags=["Settings"],
    responses={
        500: {"model": models.ErrorDetail, "description": "Failed to load or format settings"}
    }
)
async def get_current_settings(vs: VoiceSystem = Depends(get_voice_system)):
    """
    Retrieves the current application configuration.
    """
    try:
        current_settings_dict = vs.get_settings()
        # Validate against the Pydantic model before returning
        return models.AppSettings(**current_settings_dict)
    except Exception as e:
        logger.error(f"Error constructing settings response model from current config: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to format current settings. Config might be corrupt. Error: {str(e)}"
        )


@app.put(
    "/settings",
    response_model=models.AppSettings, # Return the updated settings
    summary="Update Settings",
    tags=["Settings"],
    responses={
        400: {"model": models.ErrorDetail, "description": "Validation error or bad setting value"},
        500: {"model": models.ErrorDetail, "description": "Internal error during update"}
    }
)
async def update_application_settings(
    settings_update: models.SettingsUpdateRequest = Body(...),
    vs: VoiceSystem = Depends(get_voice_system)
):
    """
    Updates application settings. Provide only the keys and sections you want to change.
    Nested settings sections (like volumes, voice) must be provided as complete objects
    if you wish to update any part of them (the backend merges recursively).
    Saves the updated configuration to `config.yaml` after validation.
    Returns the complete, updated settings structure.
    """
    # Convert Pydantic model to dict, excluding unset fields (fields not provided in the request)
    update_data = settings_update.model_dump(exclude_unset=True)

    if not update_data:
        # Return current settings if nothing was provided? Or raise error?
        # Let's raise an error for an empty update request.
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No settings provided for update.")

    success, message = vs.update_settings(update_data)

    if not success:
        # update_settings should have logged the error. message contains details.
        # Determine if it was a validation error (400) or internal (500)
        if "Błąd walidacji" in message:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
        else:
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=message)


    # Return the full, updated settings from the voice system instance
    try:
        updated_settings_model = models.AppSettings(**vs.get_settings())
        return updated_settings_model
    except Exception as e:
         logger.error(f"Error constructing updated settings response model after successful update: {e}", exc_info=True)
         # Settings were updated, but response formatting failed. Return 200 OK with a warning message?
         # Or 500 because the response is broken? Let's go with 500.
         raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Settings updated successfully, but failed to format response. Error: {str(e)}"
         )


# --- Root Endpoint ---
@app.get("/", summary="API Root/Health Check", tags=["General"], response_model=Dict[str, str])
async def read_root():
    """Basic health check endpoint."""
    return {"message": "Voice Line & Radio Manager API is running."}

# --- Add CORS Support to FastAPI Backend---
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://{HOST_IP_ORIGIN}:3000"],  # React app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Running the App (for local development) ---
# Use `uvicorn main:app --reload` in the terminal
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server for local development...")
    # Recommended command: uvicorn main:app --reload --host 0.0.0.0 --port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8060, reload=True)
