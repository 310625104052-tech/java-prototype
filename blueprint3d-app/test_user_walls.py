import math

walls_18 = [
    {"id": "wall-1", "parentWallId": "wall-h-1", "x1": 200, "y1": 200, "x2": 436, "y2": 200, "thickness": 7, "orientation": "horizontal"},
    {"id": "wall-2", "parentWallId": "wall-h-2", "x1": 211, "y1": 223, "x2": 349, "y2": 223, "thickness": 14, "orientation": "horizontal"},
    {"id": "wall-3", "parentWallId": "wall-h-3", "x1": 24, "y1": 352, "x2": 325, "y2": 352, "thickness": 31, "orientation": "horizontal"},
    {"id": "wall-4", "parentWallId": "wall-h-4", "x1": 422, "y1": 366, "x2": 646, "y2": 366, "thickness": 8, "orientation": "horizontal"},
    {"id": "wall-5", "parentWallId": "wall-h-5", "x1": 89, "y1": 449, "x2": 238, "y2": 449, "thickness": 8, "orientation": "horizontal"},
    {"id": "wall-6", "parentWallId": "wall-h-6", "x1": 67, "y1": 640, "x2": 252, "y2": 640, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-7", "parentWallId": "wall-h-7", "x1": 422, "y1": 646, "x2": 646, "y2": 646, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-8", "parentWallId": "wall-h-8", "x1": 281, "y1": 704, "x2": 415, "y2": 704, "thickness": 13, "orientation": "horizontal"},
    {"id": "wall-9", "parentWallId": "wall-h-9", "x1": 322, "y1": 760, "x2": 423, "y2": 760, "thickness": 11, "orientation": "horizontal"},
    {"id": "wall-10", "parentWallId": "wall-h-10", "x1": 24, "y1": 813, "x2": 695, "y2": 813, "thickness": 12, "orientation": "horizontal"},
    {"id": "wall-11", "parentWallId": "wall-v-11", "x1": 112, "y1": 359, "x2": 112, "y2": 864, "thickness": 20, "orientation": "vertical"},
    {"id": "wall-12", "parentWallId": "wall-v-12", "x1": 234, "y1": 512, "x2": 234, "y2": 638, "thickness": 7, "orientation": "vertical"},
    {"id": "wall-13", "parentWallId": "wall-v-13", "x1": 307, "y1": 636, "x2": 307, "y2": 816, "thickness": 14, "orientation": "vertical"},
    {"id": "wall-14", "parentWallId": "wall-v-14", "x1": 321, "y1": 636, "x2": 321, "y2": 816, "thickness": 12, "orientation": "vertical"},
    {"id": "wall-15", "parentWallId": "wall-v-15", "x1": 375, "y1": 675, "x2": 375, "y2": 835, "thickness": 6, "orientation": "vertical"},
    {"id": "wall-16", "parentWallId": "wall-v-16", "x1": 428, "y1": 636, "x2": 428, "y2": 816, "thickness": 8, "orientation": "vertical"},
    {"id": "wall-17", "parentWallId": "wall-v-17", "x1": 430, "y1": 152, "x2": 430, "y2": 374, "thickness": 12, "orientation": "vertical"},
    {"id": "wall-18", "parentWallId": "wall-v-18", "x1": 598, "y1": 359, "x2": 598, "y2": 867, "thickness": 12, "orientation": "vertical"},
]

for w in walls_18:
    length = math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])
    w["length"] = length
    print(f"{w['id']:7} | {w['orientation'][:4]} | ({w['x1']:3},{w['y1']:3})->({w['x2']:3},{w['y2']:3}) | L:{length:5.1f} | T:{w['thickness']:2}")
