from backend.wall_detector import _pair_parallel_wall_boundaries
import numpy as np

wall_fill_mask = np.ones((1024, 1024), dtype=np.uint8) * 255
lines = [
    {"x1": 159, "x2": 215, "y1": 199, "y2": 199, "length": 56, "orientation": "horizontal"},
    {"x1": 170, "x2": 226, "y1": 215, "y2": 215, "length": 56, "orientation": "horizontal"},
    {"x1": 232, "x2": 283, "y1": 215, "y2": 215, "length": 51, "orientation": "horizontal"},
    {"x1": 285, "x2": 341, "y1": 199, "y2": 199, "length": 56, "orientation": "horizontal"},
    {"x1": 328, "x2": 400, "y1": 215, "y2": 215, "length": 72, "orientation": "horizontal"}
]

paired, _ = _pair_parallel_wall_boundaries(lines, wall_fill_mask, 5, 36, 25, 0.30, 12)
for p in paired:
    print(p)
