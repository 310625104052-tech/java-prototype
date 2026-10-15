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

# Calculate structural score for each wall
# Evidence:
# 1. Length (0..30 pts)
# 2. Thickness (0..25 pts, >= 10 is good, <= 7 is penalized)
# 3. Structural junctions (0..25 pts, 1 junction = 10, 2+ junctions = 25)
# 4. Staircase penalty (-100 pts)
# 5. Isolated thin structure penalty (-30 pts if T<=8 and junctions<=1 and length<200)

for w in walls_18:
    length = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
    thick = w["thickness"]
    
    # Count junctions with other perpendicular walls
    junctions = 0
    perp_ori = "vertical" if w["orientation"] == "horizontal" else "horizontal"
    for other in walls_18:
        if other["id"] == w["id"]: continue
        if other["orientation"] != perp_ori: continue
        # Distance from endpoints of w to other segment
        d1 = pt_to_seg_dist(w["x1"], w["y1"], other["x1"], other["y1"], other["x2"], other["y2"])
        d2 = pt_to_seg_dist(w["x2"], w["y2"], other["x1"], other["y1"], other["x2"], other["y2"])
        # Distance from endpoints of other to w segment
        d3 = pt_to_seg_dist(other["x1"], other["y1"], w["x1"], w["y1"], w["x2"], w["y2"])
        d4 = pt_to_seg_dist(other["x2"], other["y2"], w["x1"], w["y1"], w["x2"], w["y2"])
        
        tol = max(thick, other["thickness"]) + 15
        if min(d1, d2, d3, d4) <= tol:
            junctions += 1
            
    score = 0.0
    # Length score
    score += min(30.0, length / 10.0)
    # Thickness score
    if thick >= 12:
        score += 25.0
    elif thick >= 10:
        score += 18.0
    elif thick >= 8:
        score += 8.0
    else:
        score += 0.0
        
    # Junctions
    if junctions >= 2:
        score += 30.0
    elif junctions == 1:
        score += 15.0
        
    # Is it stair?
    is_stair = w["id"] in ["wall-13", "wall-14", "wall-15", "wall-16", "wall-8", "wall-9"]
    if is_stair:
        score -= 60.0
        
    # Isolated thin cabinet/furniture
    if thick <= 8 and junctions <= 1 and length < 200:
        score -= 35.0
        
    print(f"{w['id']:7} | {w['orientation'][:4]} | L:{length:5.1f} | T:{thick:2} | Junc:{junctions} | Score:{score:5.1f} | {'STAIR' if is_stair else ('CABINET' if score < 30 else 'WALL')}")
