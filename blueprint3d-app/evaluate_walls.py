import cv2, os, json, sys, base64
from backend.wall_detector import detect_walls_from_image_bytes
from google import genai
from google.genai import types

def encode_image(img):
    _, buffer = cv2.imencode('.png', img)
    return buffer.tobytes()

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

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

prompt = f"""
You are a computer vision architect evaluating a wall detection algorithm on a residential blueprint.
I am providing two images:
1. The original blueprint.
2. The annotated blueprint where detected walls are drawn as bright green lines and labeled with their wall ID in red text.

Here is the coordinate data for the 18 detected walls:
{wall_data_str}

Please create a clear validation report.
For every detected wall, state:
- wall ID
- whether it corresponds to a visible structural wall in the uploaded blueprint
- what region/room it belongs to
- whether it is a complete wall or a fragmented piece

Then, identify:
- Which detected walls correspond to the actual exterior walls.
- Which detected walls correspond to actual interior walls.
- Any false-positive walls caused by stairs
- Any false-positive walls caused by cabinets/furniture
- Any false-positive walls caused by text
- Any false-positive walls caused by dimensions
- Any actual structural walls that are missing (look closely at the perimeter and internal dividers, especially gaps not covered by green lines)
- Any walls that are incorrectly merged
- Any walls that are incorrectly split
- Which walls are still fragmented.

End your response with a conclusion of EXACTLY one of the following two options, based on whether the structural representation perfectly aligns with the thick black walls in the drawing and avoids thin details:
READY FOR MILESTONE 3
or
NOT READY — NEEDS ONE MORE DETECTION REFINEMENT
"""

response = client.models.generate_content(
    model='gemini-2.5-pro',
    contents=[
        types.Part.from_bytes(data=encode_image(img), mime_type='image/png'),
        types.Part.from_bytes(data=encode_image(annotated), mime_type='image/png'),
        prompt
    ]
)
print(response.text)
