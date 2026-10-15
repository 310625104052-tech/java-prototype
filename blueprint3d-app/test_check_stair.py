import prototype_filter
from test_scoring import walls_18

stair_indices = prototype_filter.detect_staircase_patterns(walls_18)
for idx in sorted(stair_indices):
    w = walls_18[idx]
    print(f"Stair idx {idx}: {w['id']} | ({w['x1']},{w['y1']})->({w['x2']},{w['y2']})")
