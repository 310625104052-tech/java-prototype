import logging
import os
import sys

# Must be set before cv2 is imported: caps decoded pixel count so a tiny
# compressed file can't expand into gigabytes of RAM (decompression bomb).
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(50_000_000))

from fastapi import FastAPI, File, UploadFile, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

logger = logging.getLogger("blueprint3d")

# Ensure backend directory and project root are on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
for path in [PROJECT_ROOT, BASE_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

try:
    from backend.wall_detector import detect_walls_from_image_bytes, DETECTION_CONFIG
    WALL_DETECTOR_AVAILABLE = True
except Exception as imp_err1:
    try:
        from wall_detector import detect_walls_from_image_bytes, DETECTION_CONFIG
        WALL_DETECTOR_AVAILABLE = True
    except Exception as imp_err2:
        logger.warning("wall_detector import failed: %s | %s", imp_err1, imp_err2)
        detect_walls_from_image_bytes = None
        DETECTION_CONFIG = {}
        WALL_DETECTOR_AVAILABLE = False

try:
    from backend.blueprint_import import import_blueprint
except ImportError:
    from blueprint_import import import_blueprint

app = FastAPI(title="Blueprint3D Backend API", version="0.3.0")


# Custom exception handlers - guarantee only JSON is returned, never HTML
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0].get("msg", "Invalid request parameters") if errors else "Validation error"
    field = ".".join(str(loc) for loc in errors[0].get("loc", [])) if errors else "request"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": f"Validation error on {field}: {msg}",
            "details": exc.errors()
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": str(exc.detail)}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log details server-side; never echo internals to the client.
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": "Internal server error."}
    )


# Local dev only: the Vite dev server (port 3000) proxies /api, so browsers
# normally never make cross-origin calls. Allow just the dev origins, no cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".dxf"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "blueprint3d-fastapi",
        "opencv": WALL_DETECTOR_AVAILABLE,
        "parameters": DETECTION_CONFIG,
    }


@app.get("/api/blueprint/detect")
@app.get("/api/blueprint/upload")
async def detect_blueprint_get_help():
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "success": False,
            "error": "The /api/blueprint/detect endpoint requires an HTTP POST request with a multipart/form-data 'file' field containing a PNG or JPEG blueprint image."
        }
    )


def _error(code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=code, content={"success": False, "error": message})


@app.post("/api/blueprint/detect")
@app.post("/api/blueprint/upload")
async def process_and_detect_blueprint(file: UploadFile = File(...)):
    """
    Receives blueprint image file, validates format, runs the OpenCV wall detection pipeline,
    and returns detected wall line segments, dimensions, debug overlay, and binary image.
    """
    if not file or not file.filename:
        return _error(status.HTTP_400_BAD_REQUEST,
                      "No file was uploaded. Please select a valid PNG or JPEG blueprint image.")

    filename = file.filename
    # Extension is the gate; the client-supplied Content-Type is not trustworthy.
    if not any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS):
        return _error(status.HTTP_400_BAD_REQUEST,
                      f"Invalid file format for '{filename}'. Use PNG, JPG, JPEG, or DXF files.")

    # Read at most MAX_UPLOAD_BYTES + 1 so oversized uploads are rejected
    # without buffering the whole body.
    try:
        contents = await file.read(MAX_UPLOAD_BYTES + 1)
    except Exception:
        logger.exception("Failed to read upload")
        return _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to read uploaded file.")

    size_bytes = len(contents)
    if size_bytes == 0:
        return _error(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty (0 bytes).")
    if size_bytes > MAX_UPLOAD_BYTES:
        return _error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                      f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.")

    if not WALL_DETECTOR_AVAILABLE or detect_walls_from_image_bytes is None:
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE,
                      "The structural wall detection module is currently initializing or unavailable.")

    try:
        detection_result = import_blueprint(contents, filename)
    except ValueError as exc:
        return _error(status.HTTP_400_BAD_REQUEST, str(exc))
    except Exception:
        logger.exception("Wall detection crashed")
        return _error(status.HTTP_500_INTERNAL_SERVER_ERROR,
                      "Unexpected error during blueprint processing.")

    if not detection_result.get("success", False):
        return _error(status.HTTP_422_UNPROCESSABLE_ENTITY,
                      detection_result.get("error", "Wall detection failed on the provided image."))

    response_payload = {
        "success": True,
        "mode": detection_result.get("mode", "model"),
        "import_info": detection_result.get("import_info", {}),
        "preview_image": detection_result.get("preview_image", ""),
        "filename": filename,
        "content_type": file.content_type or "image/png",
        "size_bytes": size_bytes,
        "walls": detection_result["walls"],
        "wall_count": len(detection_result["walls"]),
        "wall_regions": detection_result.get("wall_regions", []),
        "openings": detection_result.get("openings", []),
        "rooms": detection_result.get("rooms", []),
        "shell": detection_result.get("shell"),
        "scale": detection_result.get("scale", {}),
        "debug_layers": detection_result.get("debug_layers", {}),
        "image_width": detection_result["image_width"],
        "image_height": detection_result["image_height"],
        "pipeline_counts": detection_result.get("pipeline_counts", {}),
        "debug_image": detection_result["debug_image"],
        "raw_hough_image": detection_result.get("raw_hough_image", ""),
        "binary_image": detection_result["binary_image"],
        "parameters": detection_result.get("parameters", DETECTION_CONFIG),
    }

    return JSONResponse(status_code=status.HTTP_200_OK, content=response_payload)


if __name__ == "__main__":
    # Loopback only: this dev backend has no authentication.
    uvicorn.run(app, host="127.0.0.1", port=8001)
