import math
import numpy as np
from typing import List, Dict, Any, Tuple, Set

def pt_to_seg_dist(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx*dx + dy*dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def detect_staircase_patterns(walls: List[Dict[str, Any]]) -> Set[int]:
    """
    Detects staircase steps and flights:
    - 3+ parallel lines with regular spacing (8px to 75px) in a compact zone
    - Also includes horizontal/vertical steps bounded within the staircase zone
    Returns indices of walls to reject.
    """
    rejected_indices = set()
    n = len(walls)
    if n == 0:
        return rejected_indices

    # Check parallel groups for vertical flights
    for orientation in ["vertical", "horizontal"]:
        candidates = [(i, w) for i, w in enumerate(walls) if w.get("orientation") == orientation]
        for idx1, (i, w1) in enumerate(candidates):
            group = [(i, w1)]
            for idx2, (j, w2) in enumerate(candidates):
                if i == j:
                    continue
                if orientation == "vertical":
                    y_overlap = min(max(w1["y1"], w1["y2"]), max(w2["y1"], w2["y2"])) - max(min(w1["y1"], w1["y2"]), min(w2["y1"], w2["y2"]))
                    min_len = min(abs(w1["y2"] - w1["y1"]), abs(w2["y2"] - w2["y1"]))
                    dist_perp = abs(w1["x1"] - w2["x1"])
                else:
                    x_overlap = min(max(w1["x1"], w1["x2"]), max(w2["x1"], w2["x2"])) - max(min(w1["x1"], w1["x2"]), min(w2["x1"], w2["x2"]))
                    min_len = min(abs(w1["x2"] - w1["x1"]), abs(w2["x2"] - w2["x1"]))
                    dist_perp = abs(w1["y1"] - w2["y1"])

                # Parallel lines with high longitudinal overlap and reasonable staircase width
                if min_len > 0 and (x_overlap if orientation == "horizontal" else y_overlap) / min_len >= 0.50:
                    if dist_perp <= 160: # within staircase flight span
                        group.append((j, w2))

            if len(group) >= 3:
                # Check spacing regularity
                if orientation == "vertical":
                    sorted_group = sorted(group, key=lambda item: item[1]["x1"])
                    perps = [item[1]["x1"] for item in sorted_group]
                else:
                    sorted_group = sorted(group, key=lambda item: item[1]["y1"])
                    perps = [item[1]["y1"] for item in sorted_group]

                diffs = [perps[k+1] - perps[k] for k in range(len(perps)-1) if perps[k+1] != perps[k]]
                if diffs and all(7 <= d <= 80 for d in diffs):
                    # Staircase flight detected!
                    # Do NOT reject major exterior walls (e.g. length > 400px that span far beyond)
                    max_flight_len = max(abs(item[1]["y2"] - item[1]["y1"]) if orientation == "vertical" else abs(item[1]["x2"] - item[1]["x1"]) for item in sorted_group)
                    for item in sorted_group:
                        w = item[1]
                        w_len = abs(w["y2"] - w["y1"]) if orientation == "vertical" else abs(w["x2"] - w["x1"])
                        # If segment is within 1.5x of the flight length, it's a stair element
                        if w_len <= max_flight_len * 1.5:
                            rejected_indices.add(item[0])

    # Now tag intermediate steps inside the bounding box of rejected staircase elements
    if rejected_indices:
        stair_walls = [walls[i] for i in rejected_indices]
        min_x = min(min(w["x1"], w["x2"]) for w in stair_walls) - 25
        max_x = max(max(w["x1"], w["x2"]) for w in stair_walls) + 25
        min_y = min(min(w["y1"], w["y2"]) for w in stair_walls) - 25
        max_y = max(max(w["y1"], w["y2"]) for w in stair_walls) + 25

        for i, w in enumerate(walls):
            if i in rejected_indices:
                continue
            wx_min, wx_max = min(w["x1"], w["x2"]), max(w["x1"], w["x2"])
            wy_min, wy_max = min(w["y1"], w["y2"]), max(w["y1"], w["y2"])
            w_len = math.hypot(wx_max - wx_min, wy_max - wy_min)

            # If segment is completely inside the stair bounding box and shorter than the entire stairwell
            if wx_min >= min_x and wx_max <= max_x and wy_min >= min_y and wy_max <= max_y:
                # Do not reject long perimeter walls that pass through
                if w_len < max(max_x - min_x, max_y - min_y) * 1.2:
                    rejected_indices.add(i)

    return rejected_indices


def consolidate_close_parallel_walls(walls: List[Dict[str, Any]], max_perp_dist: int = 25) -> List[Dict[str, Any]]:
    """
    Consolidates very close parallel lines representing a single physical thick wall.
    E.g. two centerlines separated by <= 25px with substantial overlap.
    """
    consolidated = []
    used = set()

    for i in range(len(walls)):
        if i in used:
            continue
        w1 = walls[i]
        best_j = None
        best_overlap = -1

        for j in range(i + 1, len(walls)):
            if j in used:
                continue
            w2 = walls[j]
            if w1["orientation"] != w2["orientation"]:
                continue

            if w1["orientation"] == "horizontal":
                dist_y = abs(w1["y1"] - w2["y1"])
                if dist_y <= max_perp_dist:
                    overlap = min(max(w1["x1"], w1["x2"]), max(w2["x1"], w2["x2"])) - max(min(w1["x1"], w1["x2"]), min(w2["x1"], w2["x2"]))
                    min_l = min(abs(w1["x2"] - w1["x1"]), abs(w2["x2"] - w2["x1"]))
                    if min_l > 0 and overlap / min_l >= 0.40:
                        if overlap > best_overlap:
                            best_overlap = overlap
                            best_j = j
            elif w1["orientation"] == "vertical":
                dist_x = abs(w1["x1"] - w2["x1"])
                if dist_x <= max_perp_dist:
                    overlap = min(max(w1["y1"], w1["y2"]), max(w2["y1"], w2["y2"])) - max(min(w1["y1"], w1["y2"]), min(w2["y1"], w2["y2"]))
                    min_l = min(abs(w1["y2"] - w1["y1"]), abs(w2["y2"] - w2["y1"]))
                    if min_l > 0 and overlap / min_l >= 0.40:
                        if overlap > best_overlap:
                            best_overlap = overlap
                            best_j = j

        if best_j is not None:
            w2 = walls[best_j]
            used.add(i)
            used.add(best_j)
            if w1["orientation"] == "horizontal":
                new_y = int(round((w1["y1"] + w2["y1"]) / 2))
                new_x1 = min(min(w1["x1"], w1["x2"]), min(w2["x1"], w2["x2"]))
                new_x2 = max(max(w1["x1"], w1["x2"]), max(w2["x1"], w2["x2"]))
                new_thick = max(w1["thickness"], w2["thickness"], abs(w1["y1"] - w2["y1"]))
                consolidated.append({
                    "x1": new_x1, "y1": new_y, "x2": new_x2, "y2": new_y,
                    "thickness": new_thick, "orientation": "horizontal",
                    "id": w1.get("id", f"wall-c-{i}"),
                })
            else:
                new_x = int(round((w1["x1"] + w2["x1"]) / 2))
                new_y1 = min(min(w1["y1"], w1["y2"]), min(w2["y1"], w2["y2"]))
                new_y2 = max(max(w1["y1"], w1["y2"]), max(w2["y1"], w2["y2"]))
                new_thick = max(w1["thickness"], w2["thickness"], abs(w1["x1"] - w2["x1"]))
                consolidated.append({
                    "x1": new_x, "y1": new_y1, "x2": new_x, "y2": new_y2,
                    "thickness": new_thick, "orientation": "vertical",
                    "id": w1.get("id", f"wall-c-{i}"),
                })
        else:
            used.add(i)
            consolidated.append(dict(w1))

    return consolidated


def filter_structural_context(walls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Applies structural context scoring:
    - Rejects staircase patterns
    - Consolidates close parallel walls
    - Rejects isolated thin cabinet / furniture structures
    - Preserves legitimate short walls with structural junctions
    """
    # 1. Staircase detection
    stair_indices = detect_staircase_patterns(walls)
    non_stair_walls = [w for i, w in enumerate(walls) if i not in stair_indices]

    # 2. Consolidate close parallel walls
    consolidated = consolidate_close_parallel_walls(non_stair_walls, max_perp_dist=25)

    # 3. Structural scoring and connectivity graph
    # Count junctions between perpendicular walls
    surviving_walls = []
    for w in consolidated:
        w_len = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
        thick = w.get("thickness", 12)
        perp_ori = "vertical" if w["orientation"] == "horizontal" else "horizontal"

        junctions = 0
        for other in consolidated:
            if other is w or other["orientation"] != perp_ori:
                continue
            d1 = pt_to_seg_dist(w["x1"], w["y1"], other["x1"], other["y1"], other["x2"], other["y2"])
            d2 = pt_to_seg_dist(w["x2"], w["y2"], other["x1"], other["y1"], other["x2"], other["y2"])
            d3 = pt_to_seg_dist(other["x1"], other["y1"], w["x1"], w["y1"], w["x2"], w["y2"])
            d4 = pt_to_seg_dist(other["x2"], other["y2"], w["x1"], w["y1"], w["x2"], w["y2"])
            tol = max(thick, other.get("thickness", 12)) + 18
            if min(d1, d2, d3, d4) <= tol:
                junctions += 1

        # Decision rules:
        # A. Long walls (length >= 180) are almost always structural
        if w_len >= 180:
            surviving_walls.append(w)
            continue

        # B. Cabinet / furniture rejection:
        # Thin structure (thickness <= 8) with <= 1 junction and length < 180 is furniture/cabinet
        if thick <= 8 and junctions <= 1:
            print(f"REJECTED cabinet/furniture: {w['id']} L={w_len:.1f} T={thick} Junc={junctions}")
            continue

        # C. Floating structure: 0 junctions and length < 160
        if junctions == 0 and w_len < 160:
            print(f"REJECTED floating segment: {w['id']} L={w_len:.1f} T={thick} Junc={junctions}")
            continue

        # D. Legitimate short walls:
        # Has at least 1 junction AND thickness >= 9 (structural wall core) -> PRESERVE
        surviving_walls.append(w)

    return surviving_walls

