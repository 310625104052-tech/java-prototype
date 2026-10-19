import cv2
import numpy as np
import base64
import math
try:
    from .structural_evidence import prepare_structure, exterior
    from .shell_geometry import build_shell
except ImportError:
    from structural_evidence import prepare_structure, exterior
    from shell_geometry import build_shell
from typing import Dict, Any, List, Tuple, Optional

# ==============================================================================
# Configurable Parameters for Structural College Floorplan Detection
# ==============================================================================
DETECTION_CONFIG = {
    "MIN_WALL_LENGTH_PX": 30,           # Minimum length for a confirmed wall segment
    "MIN_WALL_CORE_HALF_THICK": 2.5,     # Distance transform threshold for wall core (5px full width)
    "MAX_WALL_THICKNESS_PX": 60,         # Max expected wall thickness in pixels
    "DEFAULT_WALL_THICKNESS_PX": 12,     # Fallback wall thickness
    "ORTHOGONAL_SNAP_DEG": 8.0,          # Snap near-orthogonal lines within +-8 degrees
    "COLLINEAR_MERGE_DIST_PX": 8,        # Max perpendicular distance to merge collinear segments
    "COLLINEAR_MERGE_GAP_PX": 110,       # Max longitudinal gap to bridge collinear walls (doors)
    "MIN_ROOM_AREA_PX": 400,             # Minimum enclosed area to register as a distinct room
    "DOOR_MIN_WIDTH_PX": 20,             # Minimum opening width for a door
    "DOOR_MAX_WIDTH_PX": 95,             # Maximum opening width for a door
    "STANDARD_SINGLE_DOOR_M": 0.90,      # Standard single door width in meters
    "STANDARD_DOUBLE_DOOR_M": 1.80,      # Standard double door width in meters
    "DEFAULT_PIXELS_PER_METER": 40.0,    # Fallback scale: 40px = 1m
}


def _encode_image_to_base64_png(image: np.ndarray) -> str:
    """Encodes an OpenCV image to a base64 PNG data URL."""
    try:
        success, buffer = cv2.imencode('.png', image)
        if not success:
            return ""
        b64_str = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{b64_str}"
    except Exception:
        return ""


def _morphological_skeleton(binary_mask: np.ndarray) -> np.ndarray:
    """
    Computes a 1-pixel wide morphological skeleton of a binary mask.
    Works robustly on standard CPU without heavy dependencies.
    """
    img = binary_mask.copy()
    skeleton = np.zeros(img.shape, np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    for _ in range(100):
        eroded = cv2.erode(img, element)
        temp = cv2.dilate(eroded, element)
        temp = cv2.subtract(img, temp)
        skeleton = cv2.bitwise_or(skeleton, temp)
        img = eroded.copy()
        if cv2.countNonZero(img) == 0:
            break

    return skeleton


def _snap_angle(x1: float, y1: float, x2: float, y2: float, tolerance_deg: float = 8.0) -> Tuple[float, float, float, float, str]:
    """
    Snaps near-horizontal and near-vertical segments to strict orthogonal axes.
    """
    dx = x2 - x1
    dy = y2 - y1
    angle = math.degrees(math.atan2(abs(dy), abs(dx)))

    if angle <= tolerance_deg:
        # Snap to horizontal
        avg_y = (y1 + y2) / 2.0
        return float(x1), float(avg_y), float(x2), float(avg_y), "horizontal"
    elif angle >= (90.0 - tolerance_deg):
        # Snap to vertical
        avg_x = (x1 + x2) / 2.0
        return float(avg_x), float(y1), float(avg_x), float(y2), "vertical"
    else:
        return float(x1), float(y1), float(x2), float(y2), "diagonal"


def detect_walls_from_image_bytes(image_bytes: bytes) -> Dict[str, Any]:
    """
    Region-Based Structural Blueprint Detection Pipeline for College Buildings.
    Converts floor plan drawings into structured wall regions, centerlines,
    doors, windows, and rooms with calibrated metric scale.
    """
    # 1. Image Decoding
    np_arr = np.frombuffer(image_bytes, np.uint8)
    try:
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except cv2.error:
        img = None

    if img is None:
        return {
            "success": False,
            "error": "Failed to decode blueprint image. Supported formats: PNG, JPEG, JPG."
        }

    try:
        img, raw_fg, structural_wall_mask, topology_mask, opening_candidates, stroke_px, import_info = prepare_structure(img)
    except ValueError as exc:
        return {"success": False, "error": str(exc)}
    h_img, w_img = img.shape[:2]
    clean_fg = raw_fg
    dist_transform = cv2.distanceTransform(topology_mask, cv2.DIST_L2, 5)
    outside_floor = exterior(topology_mask > 0)
    near_outside = cv2.dilate(outside_floor.astype(np.uint8),
                              np.ones((stroke_px * 2 + 3, stroke_px * 2 + 3), np.uint8))

    def is_exterior_line(x1, y1, x2, y2):
        samples = []
        for t in np.linspace(.15, .85, 5):
            x = int(np.clip(x1 + t * (x2-x1), 0, w_img-1))
            y = int(np.clip(y1 + t * (y2-y1), 0, h_img-1))
            samples.append(bool(near_outside[y,x]))
        return sum(samples) >= 3

    # 4. Extract Wall Polygons & Contours
    contours, hierarchy = cv2.findContours(structural_wall_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    wall_regions: List[Dict[str, Any]] = []
    region_idx = 1

    for cnt in contours:
        area = float(cv2.contourArea(cnt))
        if area < 80:
            continue

        x, y, w, h = cv2.boundingRect(cnt)
        # Simplify contour
        epsilon = 2.5
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        poly_pts = [[float(pt[0][0]), float(pt[0][1])] for pt in approx]

        aspect_ratio = max(w, h) / max(1, min(w, h))
        is_exterior = (x <= 60 or y <= 60 or (x + w) >= (w_img - 60) or (y + h) >= (h_img - 60))

        wall_regions.append({
            "id": f"wall-region-{region_idx}",
            "area": area,
            "bbox": {"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
            "polygon": poly_pts,
            "wallType": "exterior" if is_exterior else "interior",
            "confidence": 0.94 if is_exterior else 0.88,
        })
        region_idx += 1

    # 5. Extract Centerlines & Wall Thickness via Medial Axis / Skeleton
    skeleton = _morphological_skeleton(topology_mask)

    # Vectorize skeleton into line segments
    # Use HoughLinesP on skeleton (which is strictly 1-pixel wide) to extract exact linear centerlines
    hough_lines = cv2.HoughLinesP(
        skeleton,
        rho=1,
        theta=np.pi / 180,
        threshold=25,
        minLineLength=int(DETECTION_CONFIG["MIN_WALL_LENGTH_PX"]),
        maxLineGap=max(2, round(stroke_px * .5))
    )

    detected_centerlines: List[Dict[str, Any]] = []
    if hough_lines is not None:
        # OpenCV <=4 returns (N, 1, 4); OpenCV 5 returns (N, 4). Normalise to (N, 4).
        for x1, y1, x2, y2 in np.asarray(hough_lines).reshape(-1, 4):
            length = math.hypot(x2 - x1, y2 - y1)
            if length < float(DETECTION_CONFIG["MIN_WALL_LENGTH_PX"]):
                continue

            # Snap to orthogonal
            sx1, sy1, sx2, sy2, orientation = _snap_angle(x1, y1, x2, y2, float(DETECTION_CONFIG["ORTHOGONAL_SNAP_DEG"]))

            # Sample distance transform along the segment to measure true physical wall thickness
            samples = []
            num_samples = max(3, int(length / 10))
            for t in np.linspace(0.1, 0.9, num_samples):
                px = int(sx1 + t * (sx2 - sx1))
                py = int(sy1 + t * (sy2 - sy1))
                if 0 <= px < w_img and 0 <= py < h_img:
                    d_val = dist_transform[py, px]
                    if d_val > 0.5:
                        samples.append(float(d_val * 2.0))

            thickness = float(np.median(samples)) if samples else float(DETECTION_CONFIG["DEFAULT_WALL_THICKNESS_PX"])
            thickness = max(6.0, min(float(DETECTION_CONFIG["MAX_WALL_THICKNESS_PX"]), thickness))

            detected_centerlines.append({
                "x1": sx1,
                "y1": sy1,
                "x2": sx2,
                "y2": sy2,
                "length": length,
                "thickness": thickness,
                "orientation": orientation,
            })

    # 6. Collinear Merging of Centerlines to Prevent Fragmentation
    merged_walls: List[Dict[str, Any]] = []
    collinear_dist_tol = float(DETECTION_CONFIG["COLLINEAR_MERGE_DIST_PX"])
    collinear_gap_tol = max(2., stroke_px * .75)

    # Separate horizontal, vertical, diagonal
    horiz_lines = [l for l in detected_centerlines if l["orientation"] == "horizontal"]
    vert_lines = [l for l in detected_centerlines if l["orientation"] == "vertical"]
    diag_lines = [l for l in detected_centerlines if l["orientation"] == "diagonal"]

    # Merge horizontal
    horiz_lines.sort(key=lambda l: (l["y1"], min(l["x1"], l["x2"])))
    merged_h: List[Dict[str, Any]] = []
    for line in horiz_lines:
        x_min = min(line["x1"], line["x2"])
        x_max = max(line["x1"], line["x2"])
        y = line["y1"]
        thick = line["thickness"]

        merged = False
        for m in merged_h:
            if abs(m["y1"] - y) <= collinear_dist_tol:
                # Check overlap or gap
                if not (x_max < (m["x_min"] - collinear_gap_tol) or x_min > (m["x_max"] + collinear_gap_tol)):
                    m["x_min"] = min(m["x_min"], x_min)
                    m["x_max"] = max(m["x_max"], x_max)
                    m["thickness"] = (m["thickness"] + thick) / 2.0
                    merged = True
                    break
        if not merged:
            merged_h.append({
                "y1": y,
                "x_min": x_min,
                "x_max": x_max,
                "thickness": thick,
                "orientation": "horizontal"
            })

    # Merge vertical
    vert_lines.sort(key=lambda l: (l["x1"], min(l["y1"], l["y2"])))
    merged_v: List[Dict[str, Any]] = []
    for line in vert_lines:
        y_min = min(line["y1"], line["y2"])
        y_max = max(line["y1"], line["y2"])
        x = line["x1"]
        thick = line["thickness"]

        merged = False
        for m in merged_v:
            if abs(m["x1"] - x) <= collinear_dist_tol:
                if not (y_max < (m["y_min"] - collinear_gap_tol) or y_min > (m["y_max"] + collinear_gap_tol)):
                    m["y_min"] = min(m["y_min"], y_min)
                    m["y_max"] = max(m["y_max"], y_max)
                    m["thickness"] = (m["thickness"] + thick) / 2.0
                    merged = True
                    break
        if not merged:
            merged_v.append({
                "x1": x,
                "y_min": y_min,
                "y_max": y_max,
                "thickness": thick,
                "orientation": "vertical"
            })

    # Format final wall objects
    wall_id = 1
    for m in merged_h:
        length = m["x_max"] - m["x_min"]
        if length >= float(DETECTION_CONFIG["MIN_WALL_LENGTH_PX"]):
            is_ext = is_exterior_line(m["x_min"], m["y1"], m["x_max"], m["y1"])
            merged_walls.append({
                "id": f"wall-{wall_id}",
                "x1": round(m["x_min"], 1),
                "y1": round(m["y1"], 1),
                "x2": round(m["x_max"], 1),
                "y2": round(m["y1"], 1),
                "length": round(length, 1),
                "thickness": round(m["thickness"], 1),
                "height": 3.2,
                "wallType": "exterior" if is_ext else "interior",
                "orientation": "horizontal",
                "confidence": 0.95 if is_ext else 0.89,
                "openings": [],
            })
            wall_id += 1

    for m in merged_v:
        length = m["y_max"] - m["y_min"]
        if length >= float(DETECTION_CONFIG["MIN_WALL_LENGTH_PX"]):
            is_ext = is_exterior_line(m["x1"], m["y_min"], m["x1"], m["y_max"])
            merged_walls.append({
                "id": f"wall-{wall_id}",
                "x1": round(m["x1"], 1),
                "y1": round(m["y_min"], 1),
                "x2": round(m["x1"], 1),
                "y2": round(m["y_max"], 1),
                "length": round(length, 1),
                "thickness": round(m["thickness"], 1),
                "height": 3.2,
                "wallType": "exterior" if is_ext else "interior",
                "orientation": "vertical",
                "confidence": 0.95 if is_ext else 0.89,
                "openings": [],
            })
            wall_id += 1

    for d in diag_lines:
        if d["length"] >= float(DETECTION_CONFIG["MIN_WALL_LENGTH_PX"]) * 1.5:
            merged_walls.append({
                "id": f"wall-{wall_id}",
                "x1": round(d["x1"], 1),
                "y1": round(d["y1"], 1),
                "x2": round(d["x2"], 1),
                "y2": round(d["y2"], 1),
                "length": round(d["length"], 1),
                "thickness": round(d["thickness"], 1),
                "height": 3.2,
                "wallType": "interior",
                "orientation": "diagonal",
                "confidence": 0.82,
                "openings": [],
            })
            wall_id += 1

    diagonal_length=sum(w['length'] for w in merged_walls if w['orientation']=='diagonal')
    if diagonal_length > sum(w['length'] for w in merged_walls) * .15:
        import_info['warnings'].append('The drawing contains substantial angled walls. Door and room recovery may be incomplete; align a rotated plan with the image axes or trace its layout.')

    # 7. Openings come from structural gaps and enclosed-space topology.
    # Thin frame/arc pixels do not close a doorway, and wall thickness does not
    # decide whether a partition is exterior.
    detected_openings = []
    door_widths = [op["width"] for op in opening_candidates if op["type"] == "door"]
    typical_door = float(np.median(door_widths)) if door_widths else 0.
    for candidate in opening_candidates:
        op = dict(candidate)
        x, y, width = op["x"], op["y"], op["width"]
        vertical = op["orientation"] == "vertical"
        hosts = []
        for wall in merged_walls:
            if wall["orientation"] != op["orientation"]:
                continue
            lo, hi = sorted((wall["y1"],wall["y2"]) if vertical else (wall["x1"],wall["x2"]))
            along, across = (y,abs(x-wall["x1"])) if vertical else (x,abs(y-wall["y1"]))
            if lo <= along-width/2+stroke_px and hi >= along+width/2-stroke_px and across <= stroke_px:
                hosts.append((across,wall))
        if hosts:
            host = min(hosts,key=lambda pair:pair[0])[1]
        else:
            # A short pier can miss Hough's length floor. Give this observed gap
            # a host, so the renderer emits its lintel/glazing instead of sealing it.
            host = {"id":f"wall-{wall_id}", "x1":x if vertical else x-width/2,
                    "y1":y-width/2 if vertical else y, "x2":x if vertical else x+width/2,
                    "y2":y+width/2 if vertical else y, "length":width,
                    "thickness":float(stroke_px),"height":3.2,
                    "wallType":"exterior" if op["type"]=="window" else "interior",
                    "orientation":op["orientation"],"confidence":.75,"openings":[]}
            merged_walls.append(host)
            wall_id += 1
        op_id=f"opening-{len(detected_openings)+1}"
        is_door=op["type"]=="door"
        double=is_door and typical_door>0 and width>typical_door*1.65
        op.update(id=op_id, wallId=host["id"], parentWallId=host["id"],
                  subType=("double_door" if double else "single_door") if is_door else "exterior_window",
                  height=2.3 if is_door else 1.5, sillHeight=0. if is_door else .9, confidence=.75)
        host["openings"].append(op_id)
        detected_openings.append(op)

    # 8. Scale Calibration
    # Calibrate using detected doors (standard single door = 0.90m, double door = 1.80m)
    single_doors = [o for o in detected_openings if o.get("subType") == "single_door"]
    double_doors = [o for o in detected_openings if o.get("subType") == "double_door"]

    scale_samples = []
    for d in single_doors:
        scale_samples.append(d["width"] / float(DETECTION_CONFIG["STANDARD_SINGLE_DOOR_M"]))
    for d in double_doors:
        scale_samples.append(d["width"] / float(DETECTION_CONFIG["STANDARD_DOUBLE_DOOR_M"]))

    if scale_samples:
        pixels_per_meter = float(np.median(scale_samples))
        scale_status = "calibrated"
        scale_source = "door_width_calibration"
        scale_confidence = 0.94
    else:
        # Fallback: estimate from building footprint
        pixels_per_meter = float(DETECTION_CONFIG["DEFAULT_PIXELS_PER_METER"])
        scale_status = "estimated"
        scale_source = "college_footprint_heuristic"
        scale_confidence = 0.75

    scale_data = {
        "pixelsPerMeter": round(pixels_per_meter, 2),
        "source": scale_source,
        "confidence": scale_confidence,
        "status": scale_status,
        "referenceElement": "standard_architectural_door" if scale_samples else "college_envelope_heuristic",
    }
    narrow_doors=sum(o['type']=='door' and o['width']/pixels_per_meter < .52 for o in detected_openings)
    if narrow_doors:
        import_info['warnings'].append(f'{narrow_doors} detected openings are too narrow for walking at the estimated scale. Review the source and scale; gaps were not widened.')

    # 9. Room & Floor Space Segmentation
    # Invert structural wall mask to find enclosed spaces
    # Seal every detected door/window gap first. Otherwise any opening leaks the
    # interior into the exterior (or into its neighbours) and no room is found.
    sealed_mask = topology_mask.copy()
    void_mask = cv2.bitwise_not(sealed_mask)
    num_rooms, room_labels, room_stats, room_centroids = cv2.connectedComponentsWithStats(void_mask)

    detected_rooms: List[Dict[str, Any]] = []
    room_id = 1

    # Find which component touches the outer border (this is the exterior background)
    border_pixels = np.concatenate([
        room_labels[0, :],
        room_labels[-1, :],
        room_labels[:, 0],
        room_labels[:, -1]
    ])
    exterior_labels = set(np.unique(border_pixels).tolist())

    for r_idx in range(1, num_rooms):
        if r_idx in exterior_labels:
            continue

        area_px = int(room_stats[r_idx, cv2.CC_STAT_AREA])
        if area_px < int(DETECTION_CONFIG["MIN_ROOM_AREA_PX"]):
            continue

        rx = int(room_stats[r_idx, cv2.CC_STAT_LEFT])
        ry = int(room_stats[r_idx, cv2.CC_STAT_TOP])
        rw = int(room_stats[r_idx, cv2.CC_STAT_WIDTH])
        rh = int(room_stats[r_idx, cv2.CC_STAT_HEIGHT])

        # Convert to metric area
        area_m2 = round(area_px / (pixels_per_meter ** 2), 1)
        aspect = max(rw, rh) / max(1, min(rw, rh))

        # Room use cannot be inferred from area or aspect alone.
        room_name = f"Room {room_id}"
        room_type = "general"
        floor_type = "ceramic"
        color = "#ded9d2"

        # Room boundary polygon
        r_mask = (room_labels == r_idx).astype(np.uint8) * 255
        r_cnts, _ = cv2.findContours(r_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        poly = []
        if r_cnts:
            approx = cv2.approxPolyDP(r_cnts[0], 3.0, True)
            poly = [[float(pt[0][0]), float(pt[0][1])] for pt in approx]

        detected_rooms.append({
            "id": f"room-{room_id}",
            "name": room_name,
            "type": room_type,
            "areaM2": area_m2,
            "x": rx,
            "y": ry,
            "width": rw,
            "height": rh,
            "floorType": floor_type,
            "color": color,
            "polygon": poly,
        })
        room_id += 1

    if not merged_walls or not detected_rooms:
        return {"success":False,"error":"No reliable walls and enclosed rooms were detected. Use a clear full-size structural floor plan."}

    # 10. Generate 8 Visual Debug Layers for Frontend Test Mode & Approval
    # Layer 1: Original image
    orig_b64 = _encode_image_to_base64_png(img)

    # Layer 2: Preprocessed image (contrast enhanced)
    preproc_vis = cv2.cvtColor(clean_fg, cv2.COLOR_GRAY2BGR)
    preproc_b64 = _encode_image_to_base64_png(preproc_vis)

    # Layer 3: Structural wall mask
    struct_vis = cv2.cvtColor(structural_wall_mask, cv2.COLOR_GRAY2BGR)
    struct_b64 = _encode_image_to_base64_png(struct_vis)

    # Layer 4: Wall Polygons
    wall_poly_vis = img.copy()
    overlay_poly = img.copy()
    for reg in wall_regions:
        pts = np.array(reg["polygon"], np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(overlay_poly, [pts], (180, 240, 100))
        cv2.polylines(wall_poly_vis, [pts], True, (0, 255, 0), 2)
    cv2.addWeighted(overlay_poly, 0.35, wall_poly_vis, 0.65, 0, wall_poly_vis)
    wall_poly_b64 = _encode_image_to_base64_png(wall_poly_vis)

    # Layer 5: Centerlines & Junctions
    centerlines_vis = img.copy()
    for w in merged_walls:
        p1 = (int(w["x1"]), int(w["y1"]))
        p2 = (int(w["x2"]), int(w["y2"]))
        cv2.line(centerlines_vis, p1, p2, (0, 255, 128), 3)
        cv2.circle(centerlines_vis, p1, 5, (255, 255, 0), -1)
        cv2.circle(centerlines_vis, p2, 5, (255, 255, 0), -1)
    centerlines_b64 = _encode_image_to_base64_png(centerlines_vis)

    # Layer 6: Openings (Doors in Blue, Windows in Cyan)
    openings_vis = img.copy()
    for op in detected_openings:
        ox, oy = int(op["x"]), int(op["y"])
        ow = int(op["width"])
        color = (255, 120, 0) if op["type"] == "door" else (255, 220, 0) # BGR
        if op["orientation"] == "horizontal":
            cv2.rectangle(openings_vis, (ox - ow // 2, oy - 8), (ox + ow // 2, oy + 8), color, -1)
        else:
            cv2.rectangle(openings_vis, (ox - 8, oy - ow // 2), (ox + 8, oy + ow // 2), color, -1)
    openings_b64 = _encode_image_to_base64_png(openings_vis)

    # Layer 7: Rooms Colored Zones
    rooms_vis = img.copy()
    overlay_rooms = img.copy()
    for rm in detected_rooms:
        if rm["polygon"]:
            pts = np.array(rm["polygon"], np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(overlay_rooms, [pts], (180, 200, 240))
        cx = rm["x"] + rm["width"] // 2
        cy = rm["y"] + rm["height"] // 2
        cv2.putText(rooms_vis, f"{rm['name']}", (cx - 40, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2)
        cv2.putText(rooms_vis, f"{rm['areaM2']} m2", (cx - 20, cy + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (56, 189, 248), 1)
    cv2.addWeighted(overlay_rooms, 0.35, rooms_vis, 0.65, 0, rooms_vis)
    rooms_b64 = _encode_image_to_base64_png(rooms_vis)

    # Layer 8: Final 2D Architectural Composite
    final_2d_vis = img.copy()
    overlay_final = img.copy()
    # Fill rooms
    for rm in detected_rooms:
        if rm["polygon"]:
            pts = np.array(rm["polygon"], np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(overlay_final, [pts], (60, 80, 100))
    cv2.addWeighted(overlay_final, 0.25, final_2d_vis, 0.75, 0, final_2d_vis)

    # Draw walls
    for w in merged_walls:
        p1 = (int(w["x1"]), int(w["y1"]))
        p2 = (int(w["x2"]), int(w["y2"]))
        cv2.line(final_2d_vis, p1, p2, (0, 255, 0), 4)

    # Draw doors & windows
    for op in detected_openings:
        ox, oy = int(op["x"]), int(op["y"])
        ow = int(op["width"])
        color = (255, 120, 0) if op["type"] == "door" else (0, 240, 255)
        if op["orientation"] == "horizontal":
            cv2.rectangle(final_2d_vis, (ox - ow // 2, oy - 6), (ox + ow // 2, oy + 6), color, -1)
        else:
            cv2.rectangle(final_2d_vis, (ox - 6, oy - ow // 2), (ox + 6, oy + ow // 2), color, -1)

    # Legend & Scale Bar on Final 2D Image
    cv2.rectangle(final_2d_vis, (20, h_img - 70), (420, h_img - 20), (15, 23, 42), -1)
    cv2.rectangle(final_2d_vis, (20, h_img - 70), (420, h_img - 20), (56, 189, 248), 1)
    cv2.putText(final_2d_vis, "GREEN: Wall  |  BLUE: Door  |  CYAN: Window", (30, h_img - 48), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (240, 240, 240), 1)
    cv2.putText(final_2d_vis, f"SCALE: 1m = {round(pixels_per_meter, 1)}px ({scale_status})", (30, h_img - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (56, 189, 248), 1)
    final_2d_b64 = _encode_image_to_base64_png(final_2d_vis)

    # Assemble complete debug layers object
    debug_layers = {
        "original_image": orig_b64,
        "preprocessed_image": preproc_b64,
        "structural_mask": struct_b64,
        "wall_polygons_image": wall_poly_b64,
        "centerlines_image": centerlines_b64,
        "openings_image": openings_b64,
        "rooms_image": rooms_b64,
        "final_2d_image": final_2d_b64,
    }

    return {
        "success": True,
        "import_info": import_info,
        "image_width": w_img,
        "image_height": h_img,
        "walls": merged_walls,
        "wall_count": len(merged_walls),
        "wall_regions": wall_regions,
        "openings": detected_openings,
        "rooms": detected_rooms,
        "shell": build_shell(topology_mask, detected_openings, stroke_px),
        "scale": scale_data,
        "pipeline_counts": {
            "wall_regions": len(wall_regions),
            "confirmed_walls": len(merged_walls),
            "doors_detected": len([o for o in detected_openings if o["type"] == "door"]),
            "windows_detected": len([o for o in detected_openings if o["type"] == "window"]),
            "enclosed_rooms": len(detected_rooms),
        },
        "debug_layers": debug_layers,
        # Backward compatibility aliases
        "debug_image": final_2d_b64,
        "binary_image": struct_b64,
        "raw_hough_image": wall_poly_b64,
        "parameters": DETECTION_CONFIG,
    }
