from backend.wall_detector import _group_1d_segments
segments = [
    {"x1": 159, "x2": 215, "y1": 199, "y2": 199, "thickness": 15, "orientation": "horizontal"},
    {"x1": 170, "x2": 226, "y1": 215, "y2": 215, "thickness": 15, "orientation": "horizontal"},
    {"x1": 232, "x2": 283, "y1": 215, "y2": 215, "thickness": 15, "orientation": "horizontal"},
    {"x1": 285, "x2": 341, "y1": 199, "y2": 199, "thickness": 15, "orientation": "horizontal"},
    {"x1": 328, "x2": 400, "y1": 215, "y2": 215, "thickness": 15, "orientation": "horizontal"}
]
merged, next_pid, clusters = _group_1d_segments(segments, max_perp_dist=10, grouping_max_gap=150, physical_merge_gap=120, orientation="horizontal", start_pid=1)
for w in merged:
    print(w)
