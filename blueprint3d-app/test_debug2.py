import cv2, numpy as np, sys
sys.path.append('.')
from backend.wall_detector import _group_and_merge_collinear_centerlines

walls = [
    {"x1": 100, "y1": 207, "x2": 250, "y2": 207, "thickness": 15, "orientation": "horizontal", "id": "a"},
    {"x1": 280, "y1": 207, "x2": 400, "y2": 207, "thickness": 15, "orientation": "horizontal", "id": "b"},
    {"x1": 500, "y1": 207, "x2": 900, "y2": 207, "thickness": 15, "orientation": "horizontal", "id": "c"}
]

merged, gc, sc = _group_and_merge_collinear_centerlines(walls, 10, 150, 120)
for w in merged:
    print(f"({w['x1']},{w['y1']})->({w['x2']},{w['y2']})")
