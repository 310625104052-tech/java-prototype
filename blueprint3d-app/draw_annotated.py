import cv2, numpy as np, json
from backend.wall_detector import detect_walls_from_image_bytes

with open('/tmp/last_uploaded_blueprint.png', 'rb') as f:
    buf = f.read()

res = detect_walls_from_image_bytes(buf)
walls = res.get("walls", [])

img = cv2.imdecode(np.frombuffer(buf, np.uint8), cv2.IMREAD_COLOR)
annotated = img.copy()

wall_data_str = ""
for w in walls:
    x1, y1, x2, y2 = w['x1'], w['y1'], w['x2'], w['y2']
    cv2.line(annotated, (x1, y1), (x2, y2), (0, 255, 0), 3)
    cv2.putText(annotated, w['id'], (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
    wall_data_str += f"{w['id']} | ({x1}, {y1}) -> ({x2}, {y2}) | Thickness: {w['thickness']}\n"

cv2.imwrite('/tmp/annotated_blueprint.png', annotated)
with open('/tmp/wall_data.txt', 'w') as f:
    f.write(wall_data_str)
