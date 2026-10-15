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
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)

# Check junctions between every pair
print("=== JUNCTION ANALYSIS ===")
for i, w1 in enumerate(walls_18):
    connections = []
    for j, w2 in enumerate(walls_18):
        if i == j: continue
        # Distance between endpoints or endpoint to segment
        d_p1 = pt_to_seg_dist(w1["x1"], w1["y1"], w2["x1"], w2["y1"], w2["x2"], w2["y2"])
        d_p2 = pt_to_seg_dist(w1["x2"], w1["y2"], w2["x1"], w2["y1"], w2["x2"], w2["y2"])
        min_d = min(d_p1, d_p2)
        tol = max(w1["thickness"], w2["thickness"]) + 15
        if min_d <= tol:
            connections.append((w2["id"], round(min_d, 1)))
    print(f"{w1['id']:7} (T={w1['thickness']:2}, L={int(math.hypot(w1['x2']-w1['x1'], w1['y2']-w1['y1'])):3}) connected to: {connections}")
