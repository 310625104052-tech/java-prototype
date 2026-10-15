import math
from backend.wall_detector import _group_1d_segments
lines = [
    {"x1": 159, "x2": 215, "y1": 199, "y2": 199, "thickness": 0, "orientation": "horizontal"},
    {"x1": 170, "x2": 226, "y1": 215, "y2": 215, "thickness": 0, "orientation": "horizontal"},
    {"x1": 232, "x2": 283, "y1": 215, "y2": 215, "thickness": 0, "orientation": "horizontal"},
    {"x1": 285, "x2": 341, "y1": 199, "y2": 199, "thickness": 0, "orientation": "horizontal"},
    {"x1": 328, "x2": 400, "y1": 215, "y2": 215, "thickness": 0, "orientation": "horizontal"}
]
merged, _, _ = _group_1d_segments(lines, max_perp_dist=5, grouping_max_gap=50, physical_merge_gap=30, orientation="horizontal", start_pid=1)
for m in merged:
    print(m)
