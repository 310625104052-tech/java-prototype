import math

walls_18 = [
    {"id": "wall-1", "x1": 200, "y1": 200, "x2": 436, "y2": 200, "thickness": 7, "orientation": "horizontal"},
    {"id": "wall-2", "x1": 211, "y1": 223, "x2": 349, "y2": 223, "thickness": 14, "orientation": "horizontal"},
    {"id": "wall-3", "x1": 24, "y1": 352, "x2": 325, "y2": 352, "thickness": 31, "orientation": "horizontal"},
    {"id": "wall-4", "x1": 422, "y1": 366, "x2": 646, "y2": 366, "thickness": 8, "orientation": "horizontal"},
    {"id": "wall-5", "x1": 89, "y1": 449, "x2": 238, "y2": 449, "thickness": 8, "orientation": "horizontal"},
    {"id": "wall-6", "x1": 67, "y1": 640, "x2": 252, "y2": 640, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-7", "x1": 422, "y1": 646, "x2": 646, "y2": 646, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-8", "x1": 281, "y1": 704, "x2": 415, "y2": 704, "thickness": 13, "orientation": "horizontal"},
    {"id": "wall-9", "x1": 322, "y1": 760, "x2": 423, "y2": 760, "thickness": 11, "orientation": "horizontal"},
    {"id": "wall-10", "x1": 24, "y1": 813, "x2": 695, "y2": 813, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-11", "x1": 112, "y1": 359, "x2": 112, "y2": 864, "thickness": 20, "orientation": "vertical"},
    {"id": "wall-12", "x1": 234, "y1": 512, "x2": 234, "y2": 638, "thickness": 7, "orientation": "vertical"},
    {"id": "wall-13", "x1": 307, "y1": 636, "x2": 307, "y2": 816, "thickness": 14, "orientation": "vertical"},
    {"id": "wall-14", "x1": 321, "y1": 636, "x2": 321, "y2": 816, "thickness": 12, "orientation": "vertical"},
    {"id": "wall-15", "x1": 375, "y1": 675, "x2": 375, "y2": 835, "thickness": 6, "orientation": "vertical"},
    {"id": "wall-16", "x1": 428, "y1": 636, "x2": 428, "y2": 816, "thickness": 8, "orientation": "vertical"},
    {"id": "wall-17", "x1": 430, "y1": 152, "x2": 430, "y2": 374, "thickness": 12, "orientation": "vertical"},
    {"id": "wall-18", "x1": 598, "y1": 359, "x2": 598, "y2": 867, "thickness": 12, "orientation": "vertical"},
]

def pt_to_seg_dist(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx*dx + dy*dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def analyze_staircases(walls):
    """
    Detects compact regions containing 3+ parallel lines with regular spacing.
    Returns list of wall IDs belonging to staircase patterns.
    """
    stair_wall_ids = set()
    
    # 1. Check vertical parallel groups
    verts = [w for w in walls if w["orientation"] == "vertical"]
    # Group by overlapping Y range
    for i in range(len(verts)):
        group = [verts[i]]
        for j in range(len(verts)):
            if i == j: continue
            w1, w2 = verts[i], verts[j]
            y_overlap = min(w1["y2"], w2["y2"]) - max(w1["y1"], w2["y1"])
            min_len = min(w1["y2"]-w1["y1"], w2["y2"]-w2["y1"])
            if min_len > 0 and y_overlap / min_len >= 0.70:
                dist_x = abs(w1["x1"] - w2["x1"])
                if dist_x <= 150: # within staircase flight span
                    group.append(w2)
        if len(group) >= 3:
            # Check if spacing between consecutive x coordinates is relatively small
            group_sorted = sorted(group, key=lambda w: w["x1"])
            xs = [w["x1"] for w in group_sorted]
            diffs = [xs[k+1] - xs[k] for k in range(len(xs)-1)]
            # If all diffs are between 8 and 70px, this is a staircase flight!
            if all(8 <= d <= 70 for d in diffs):
                for w in group:
                    stair_wall_ids.add(w["id"])
                    
    # Also check horizontal steps inside the stair zone
    if stair_wall_ids:
        stair_walls = [w for w in walls if w["id"] in stair_wall_ids]
        min_x = min(min(w["x1"], w["x2"]) for w in stair_walls) - 30
        max_x = max(max(w["x1"], w["x2"]) for w in stair_walls) + 30
        min_y = min(min(w["y1"], w["y2"]) for w in stair_walls) - 20
        max_y = max(max(w["y1"], w["y2"]) for w in stair_walls) + 20
        
        for w in walls:
            if w["orientation"] == "horizontal":
                wx1, wx2 = min(w["x1"], w["x2"]), max(w["x1"], w["x2"])
                wy = w["y1"]
                # If contained within stair box
                if min_x <= wx1 and wx2 <= max_x and min_y <= wy <= max_y:
                    stair_wall_ids.add(w["id"])
                    
    return stair_wall_ids

stairs = analyze_staircases(walls_18)
print("Staircase walls detected:", sorted(list(stairs)))
