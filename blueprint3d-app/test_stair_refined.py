import math
from test_scoring import walls_18

def detect_staircase_patterns_refined(walls):
    stair_ids = set()
    
    # 1. Candidate stair lines:
    # A stair tread/flight line is ALWAYS short or medium length (typically < 190px, almost never > 200px)
    # Exterior walls (e.g. wall-10 L=671, wall-11 L=505, wall-18 L=508) are NEVER stair steps.
    stair_candidates = [
        w for w in walls 
        if math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"]) < 200
        # Stair lines typically have thickness <= 14px (often thin lines or flight dividers)
    ]
    
    # Check vertical flights
    verts = [w for w in stair_candidates if w["orientation"] == "vertical"]
    for i, w1 in enumerate(verts):
        flight = [w1]
        for j, w2 in enumerate(verts):
            if i == j: continue
            y1_max = max(w1["y1"], w1["y2"])
            y1_min = min(w1["y1"], w1["y2"])
            y2_max = max(w2["y1"], w2["y2"])
            y2_min = min(w2["y1"], w2["y2"])
            y_overlap = min(y1_max, y2_max) - max(y1_min, y2_min)
            min_l = min(y1_max - y1_min, y2_max - y2_min)
            if min_l > 0 and y_overlap / min_l >= 0.70:
                dist_x = abs(w1["x1"] - w2["x1"])
                if dist_x <= 150:
                    flight.append(w2)
        if len(flight) >= 3:
            xs = sorted(list(set(w["x1"] for w in flight)))
            diffs = [xs[k+1] - xs[k] for k in range(len(xs)-1)]
            # If spacing between adjacent vertical lines is between 8px and 70px
            if all(8 <= d <= 70 for d in diffs):
                for w in flight:
                    stair_ids.add(w["id"])

    # Check horizontal steps
    horiz = [w for w in stair_candidates if w["orientation"] == "horizontal"]
    for i, w1 in enumerate(horiz):
        flight = [w1]
        for j, w2 in enumerate(horiz):
            if i == j: continue
            x1_max = max(w1["x1"], w1["x2"])
            x1_min = min(w1["x1"], w1["x2"])
            x2_max = max(w2["x1"], w2["x2"])
            x2_min = min(w2["x1"], w2["x2"])
            x_overlap = min(x1_max, x2_max) - max(x1_min, x2_min)
            min_l = min(x1_max - x1_min, x2_max - x2_min)
            if min_l > 0 and x_overlap / min_l >= 0.70:
                dist_y = abs(w1["y1"] - w2["y1"])
                if dist_y <= 150:
                    flight.append(w2)
        if len(flight) >= 3:
            ys = sorted(list(set(w["y1"] for w in flight)))
            diffs = [ys[k+1] - ys[k] for k in range(len(ys)-1)]
            if all(8 <= d <= 70 for d in diffs):
                for w in flight:
                    stair_ids.add(w["id"])
                    
    # Also include intermediate steps inside the stairwell bounding box
    if stair_ids:
        stair_walls = [w for w in walls if w["id"] in stair_ids]
        min_x = min(min(w["x1"], w["x2"]) for w in stair_walls) - 40
        max_x = max(max(w["x1"], w["x2"]) for w in stair_walls) + 40
        min_y = min(min(w["y1"], w["y2"]) for w in stair_walls) - 20
        max_y = max(max(w["y1"], w["y2"]) for w in stair_walls) + 20
        
        for w in walls:
            if w["id"] in stair_ids: continue
            w_len = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
            # Only consider candidates that are strictly contained inside the stairwell box
            # and are short (stair steps)
            if w_len < 160:
                wx1, wx2 = min(w["x1"], w["x2"]), max(w["x1"], w["x2"])
                wy1, wy2 = min(w["y1"], w["y2"]), max(w["y1"], w["y2"])
                if wx1 >= min_x and wx2 <= max_x and wy1 >= min_y and wy2 <= max_y:
                    stair_ids.add(w["id"])

    return stair_ids

stair_ids = detect_staircase_patterns_refined(walls_18)
print("Detected stair IDs:", sorted(list(stair_ids)))
