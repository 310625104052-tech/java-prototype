"""Recover long paired wall outlines without requiring a solid black fill."""
import cv2
import numpy as np


def outlined_walls(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    rgb = img.astype(np.int16)
    neutral = rgb.max(axis=2)-rgb.min(axis=2) < 30
    # Exclude gray room fills, while retaining the darker wall edges.
    threshold = min(180, int(cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)[0]))
    raw = ((gray < max(70, threshold)) & neutral).astype(np.uint8)
    long = max(24, round(min(gray.shape)*.10))
    lines = cv2.HoughLinesP(raw*255, 1, np.pi/720, threshold=max(18,long//2),
                           minLineLength=long, maxLineGap=3)
    if lines is None:
        raise ValueError('No long wall outlines could be extracted from this image.')
    vectors = []
    for x1,y1,x2,y2 in lines.reshape(-1,4):
        a=np.array([x1,y1],float); b=np.array([x2,y2],float)
        u=(b-a)/np.linalg.norm(b-a)
        if u[0]<0 or (abs(u[0])<.01 and u[1]<0): a,b,u=b,a,-u
        vectors.append((a,b,u,np.linalg.norm(b-a)))
    wall=np.zeros_like(raw)
    max_width=max(5,min(gray.shape)*.025)
    widths=[]
    for i,(a,b,u,length) in enumerate(vectors):
        normal=np.array([-u[1],u[0]])
        for c,d,v,other_len in vectors[i+1:]:
            if abs((u[0]*v[1]-u[1]*v[0]))>.04: continue
            across=float(np.dot(c-a,normal))
            if not 2<=abs(across)<=max_width: continue
            start=max(0,float(np.dot(c-a,u)))
            end=min(length,float(np.dot(d-a,u)))
            if end-start < max(long,abs(across)*5): continue
            pts=np.array([a+u*start,a+u*end,a+u*end+normal*across,a+u*start+normal*across]).round().astype(np.int32)
            cv2.fillConvexPoly(wall,pts,1)
            widths.append(abs(across))
    # Strong single lines still provide structural evidence (thin partitions), but
    # short furniture edges and labels do not become standalone walls.
    for a,b,u,length in vectors:
        if length>=min(gray.shape)*.16:
            cv2.line(wall,tuple(a.astype(int)),tuple(b.astype(int)),1,3)
    if not wall.any():
        raise ValueError('No paired structural outlines were found.')
    count,labels,stats,_=cv2.connectedComponentsWithStats(wall)
    keep=np.zeros_like(wall)
    for i in range(1,count):
        x,y,w,h,area=stats[i]
        if max(w,h)>=long*1.3 and area>=long*2: keep[labels==i]=1
    stroke=max(3,min(18,round(float(np.median(widths))) if widths else 4))
    return raw.astype(bool),keep.astype(bool),stroke


def colored_building_crop(img):
    """Crop a large colored floor footprint, excluding a surrounding site/legend.

    Small colored furniture does not qualify. No filename or sample coordinates
    participate in this decision.
    """
    rgb=img.astype(np.int16)
    chroma=rgb.max(axis=2)-rgb.min(axis=2)
    colored=((chroma>12)&(rgb.min(axis=2)>140)).astype(np.uint8)
    count,labels,stats,_=cv2.connectedComponentsWithStats(colored)
    if count<2: return img,False
    selected=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>img.shape[0]*img.shape[1]*.025]
    if not selected: return img,False
    yy,xx=np.where(np.isin(labels,selected))
    # A site drawing has much more paper outside its colored building than a
    # conventional residential plan. Only crop when >35% can be discarded.
    pad=round(min(img.shape[:2])*.075)
    x0,x1=max(0,xx.min()-pad),min(img.shape[1],xx.max()+pad+1)
    y0,y1=max(0,yy.min()-pad),min(img.shape[0],yy.max()+pad+1)
    if (x1-x0)*(y1-y0)>img.shape[0]*img.shape[1]*.65: return img,False
    return img[y0:y1,x0:x1].copy(),True
