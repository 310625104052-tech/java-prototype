import cv2, json
from backend.wall_detector import detect_walls_from_image_bytes

with open('/tmp/last_uploaded_blueprint.png', 'rb') as f:
    buf = f.read()

res = detect_walls_from_image_bytes(buf)
for w in res.get("walls", []):
    print(f"{w.get('parentWallId', w['id'])} | {w['id']} | ({w['x1']}, {w['y1']}) -> ({w['x2']}, {w['y2']}) | Thickness: {w['thickness']}")
print("Wall Count:", len(res.get("walls", [])))
