import math
from test_scoring import walls_18

def pt_to_seg_dist(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx*dx + dy*dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def detect_staircases(walls):
    stair_ids = set()
    stair_candidates = [
        w for w in walls 
        if math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"]) < 200
    ]
    # Vertical flights
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
            if all(7 <= d <= 75 for d in diffs):
                for w in flight:
                    stair_ids.add(w["id"])

    # Horizontal flights
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
            if all(7 <= d <= 75 for d in diffs):
                for w in flight:
                    stair_ids.add(w["id"])
                    
    # Intermediate steps inside stairwell bounding box
    if stair_ids:
        stair_walls = [w for w in walls if w["id"] in stair_ids]
        min_x = min(min(w["x1"], w["x2"]) for w in stair_walls) - 40
        max_x = max(max(w["x1"], w["x2"]) for w in stair_walls) + 40
        min_y = min(min(w["y1"], w["y2"]) for w in stair_walls) - 30
        max_y = max(max(w["y1"], w["y2"]) for w in stair_walls) + 30
        
        for w in walls:
            if w["id"] in stair_ids: continue
            w_len = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
            if w_len < 160:
                wx1, wx2 = min(w["x1"], w["x2"]), max(w["x1"], w["x2"])
                wy1, wy2 = min(w["y1"], w["y2"]), max(w["y1"], w["y2"])
                if wx1 >= min_x and wx2 <= max_x and wy1 >= min_y and wy2 <= max_y:
                    stair_ids.add(w["id"])

    return stair_ids

def consolidate_close_parallels(walls, max_perp_dist=25):
    consolidated = []
    used = set()
    for i in range(len(walls)):
        if i in used: continue
        w1 = walls[i]
        best_j = None
        best_overlap = -1
        for j in range(i + 1, len(walls)):
            if j in used: continue
            w2 = walls[j]
            if w1["orientation"] != w2["orientation"]: continue
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
                    "id": f"{w1['id']}_merged_{w2['id']}",
                    "x1": new_x1, "y1": new_y, "x2": new_x2, "y2": new_y,
                    "thickness": new_thick, "orientation": "horizontal",
                })
            else:
                new_x = int(round((w1["x1"] + w2["x1"]) / 2))
                new_y1 = min(min(w1["y1"], w1["y2"]), min(w2["y1"], w2["y2"]))
                new_y2 = max(max(w1["y1"], w1["y2"]), max(w2["y1"], w2["y2"]))
                new_thick = max(w1["thickness"], w2["thickness"], abs(w1["x1"] - w2["x1"]))
                consolidated.append({
                    "id": f"{w1['id']}_merged_{w2['id']}",
                    "x1": new_x, "y1": new_y1, "x2": new_x, "y2": new_y2,
                    "thickness": new_thick, "orientation": "vertical",
                })
        else:
            used.add(i)
            consolidated.append(dict(w1))

    return consolidated

# Step 1: Reject stairs
stair_ids = detect_staircases(walls_18)
print(f"1. Rejected {len(stair_ids)} staircase elements: {sorted(list(stair_ids))}")

non_stairs = [w for w in walls_18 if w["id"] not in stair_ids]
print(f"2. Remaining after stair filter: {len(non_stairs)}")

# Step 2: Consolidate close parallels
consolidated = consolidate_close_parallels(non_stairs, max_perp_dist=25)
print(f"3. After close parallel consolidation: {len(consolidated)}")

# Step 3: Structural scoring / cabinet rejection
surviving = []
for w in consolidated:
    w_len = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
    thick = w.get("thickness", 12)
    perp_ori = "vertical" if w["orientation"] == "horizontal" else "horizontal"
    junctions = 0
    for other in consolidated:
        if other is w or other["orientation"] != perp_ori: continue
        d1 = pt_to_seg_dist(w["x1"], w["y1"], other["x1"], other["y1"], other["x2"], other["y2"])
        d2 = pt_to_seg_dist(w["x2"], w["y2"], other["x1"], other["y1"], other["x2"], other["y2"])
        d3 = pt_to_seg_dist(other["x1"], other["y1"], w["x1"], w["y1"], w["x2"], w["y2"])
        d4 = pt_to_seg_dist(other["x2"], other["y2"], w["x1"], w["y1"], w["x2"], w["y2"])
        tol = max(thick, other.get("thickness", 12)) + 18
        if min(d1, d2, d3, d4) <= tol:
            junctions += 1
            
    # Decision:
    # A. Very long walls are always structural
    if w_len >= 180:
        surviving.append((w, "Long structural wall", junctions))
        continue
    # B. Thin cabinet / furniture structure (T <= 8, length < 180, junctions <= 1)
    if thick <= 8 and junctions <= 1:
        print(f"   Rejected cabinet/furniture: {w['id']} (T={thick}, L={w_len:.1f}, Junc={junctions})")
        continue
    # C. Short segment without structural junction
    if junctions == 0 and w_len < 160:
        print(f"   Rejected floating element: {w['id']} (T={thick}, L={w_len:.1f}, Junc={junctions})")
        continue
    # D. Preserved wall
    surviving.append((w, f"Structural wall (Junc={junctions})", junctions))

print(f"\n4. FINAL SURVIVING STRUCTURAL WALLS: {len(surviving)}")
for w, reason, junc in surviving:
    l = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
    print(f"  {w['id']:22} | {w['orientation'][:4]} | ({w['x1']:3},{w['y1']:3})->({w['x2']:3},{w['y2']:3}) | L:{l:5.1f} | T:{w['thickness']:2} | {reason}")
