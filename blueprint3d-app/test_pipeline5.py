import cv2, numpy as np, sys
sys.path.append('.')
from backend.wall_detector import detect_walls_from_image_bytes

img = np.full((1024, 1024, 3), 255, dtype=np.uint8)

# Real Walls (15px thick)
cv2.rectangle(img, (100, 200), (400, 215), (0,0,0), -1)
cv2.rectangle(img, (500, 200), (900, 215), (0,0,0), -1)
cv2.rectangle(img, (100, 215), (115, 800), (0,0,0), -1)

# Cabinet (drawn as outline with 2px stroke, 100px long, 50px deep)
cv2.rectangle(img, (115, 300), (165, 400), (0,0,0), 2)

_, buf = cv2.imencode('.png', img)
res = detect_walls_from_image_bytes(buf.tobytes())

print("Counts:", res.get("pipeline_counts", res))
for w in res.get("walls", []):
    print(f"  {w['id']} | ({w['x1']},{w['y1']})->({w['x2']},{w['y2']}) T:{w['thickness']}")
