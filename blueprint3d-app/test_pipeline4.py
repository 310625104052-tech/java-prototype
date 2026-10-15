import cv2, numpy as np
img = np.full((1024, 1024, 3), 255, dtype=np.uint8)
cv2.rectangle(img, (100, 200), (400, 215), (0,0,0), -1)
cv2.rectangle(img, (500, 200), (900, 215), (0,0,0), -1)
cv2.rectangle(img, (100, 215), (115, 800), (0,0,0), -1)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
edges = cv2.Canny(blurred, 50, 150)
lines = cv2.HoughLinesP(edges, 1, np.pi/180, 45, minLineLength=45, maxLineGap=18)
for l in lines:
    print(l[0])
