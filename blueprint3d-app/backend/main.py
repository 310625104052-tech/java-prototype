from fastapi import FastAPI, File, UploadFile, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn
import os
import sys

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
        print(f"[Backend Warning] wall_detector import failed: {imp_err1} | {imp_err2}")
        detect_walls_from_image_bytes = None
        DETECTION_CONFIG = {}
        WALL_DETECTOR_AVAILABLE = False

app = FastAPI(title="Blueprint3D Backend API", version="0.3.0")

# Custom Exception Handlers - GUARANTEES ONLY JSON IS RETURNED, NEVER HTML
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
        content={
            "success": False,
            "error": str(exc.detail)
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": f"Internal server error: {str(exc)}"
        }
    )

# Enable CORS for development and proxying
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/pjpeg",
    "image/jpg",
}


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


@app.post("/api/blueprint/detect")
@app.post("/api/blueprint/upload")
async def process_and_detect_blueprint(file: UploadFile = File(...)):
    """
    Receives blueprint image file, validates format, runs the OpenCV wall detection pipeline,
    and returns detected wall line segments, dimensions, debug overlay, and binary image.
    """
    if not file or not file.filename:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": "No file was uploaded. Please select a valid PNG or JPEG blueprint image."
            }
        )

    filename = file.filename
    lower_filename = filename.lower()

    # Validate file extension
    has_valid_ext = any(lower_filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)

    # Validate content type
    content_type = file.content_type or ""
    is_valid_type = content_type.lower() in ALLOWED_CONTENT_TYPES or has_valid_ext

    if not (has_valid_ext and is_valid_type):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": f"Invalid file format for '{filename}'. Only PNG, JPG, and JPEG files are supported."
            }
        )

    try:
        # Read uploaded image bytes directly into memory
        contents = await file.read()
    except Exception as read_err:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": f"Failed to read uploaded file: {str(read_err)}"
            }
        )

    size_bytes = len(contents)
    if size_bytes == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": "Uploaded file is empty (0 bytes)."
            }
        )

    if not WALL_DETECTOR_AVAILABLE or detect_walls_from_image_bytes is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "success": False,
                "error": "The structural wall detection module is currently initializing or unavailable."
            }
        )

    # Run the OpenCV wall detection pipeline
    try:
        detection_result = detect_walls_from_image_bytes(contents)
    except Exception as detection_err:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": f"Unexpected error during OpenCV processing: {str(detection_err)}"
            }
        )

    if not detection_result.get("success", False):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": detection_result.get("error", "Wall detection failed on the provided image.")
            }
        )

    # Cache uploaded blueprint for testing and inspection
    try:
        with open("/tmp/last_uploaded_blueprint.png", "wb") as f_out:
            f_out.write(contents)
    except Exception:
        pass

    # Add metadata to response
    response_payload = {
        "success": True,
        "filename": filename,
        "content_type": content_type or "image/png",
        "size_bytes": size_bytes,
        "walls": detection_result["walls"],
        "wall_count": len(detection_result["walls"]),
        "wall_regions": detection_result.get("wall_regions", []),
        "openings": detection_result.get("openings", []),
        "rooms": detection_result.get("rooms", []),
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
    uvicorn.run(app, host="0.0.0.0", port=8001)
