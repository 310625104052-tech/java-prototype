"""Filled-wall evidence and bounded aligned openings for the React/FastAPI app.

Neutral wall fills are separated from colored room fills before morphology.
Actual gaps provide topology; no replacement door is carved through solid wall.
"""
import cv2
import numpy as np
from PIL import Image, ImageOps
try:
    from .linework import outlined_walls, colored_building_crop
except ImportError:
    from linework import outlined_walls, colored_building_crop
MIN_WALL_STROKE_PX=5
def otsu_threshold(gray: np.ndarray) -> int:
    """Textbook Otsu's method: pick the threshold maximizing between-class variance."""
    hist, _ = np.histogram(gray, bins=256, range=(0, 256))
    total = gray.size
    sum_total = float(np.dot(np.arange(256), hist))

    sum_b = 0.0
    weight_b = 0.0
    best_variance = -1.0
    best_threshold = 128

    for t in range(256):
        weight_b += hist[t]
        if weight_b == 0:
            continue
        weight_f = total - weight_b
        if weight_f == 0:
            break
        sum_b += t * hist[t]
        mean_b = sum_b / weight_b
        mean_f = (sum_total - sum_b) / weight_f
        variance_between = weight_b * weight_f * (mean_b - mean_f) ** 2
        if variance_between > best_variance:
            best_variance = variance_between
            best_threshold = t

    return best_threshold


def dilate(mask: np.ndarray) -> np.ndarray:
    rows, cols = mask.shape
    padded = np.pad(mask, 1, mode="constant", constant_values=False)
    out = np.zeros_like(mask)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= padded[1 + dy:1 + dy + rows, 1 + dx:1 + dx + cols]
    return out


def erode(mask: np.ndarray) -> np.ndarray:
    # Erosion is the dual of dilation: erode(A) = ~dilate(~A) for a symmetric structuring element.
    return ~dilate(~mask)


def estimate_stroke_px(ink: np.ndarray, percentile=75, minimum=2) -> int:
    """The thickness, in pixels, that walls are drawn at.

    Taken as the 75th percentile of horizontal ink run-lengths. Walls are the longest
    features on the page, so a large share of all scanlines cross one, which puts wall
    thickness in the upper quartile; annotation strokes are short-lived and fill the
    lower one. Runs of 1px are dropped as anti-aliasing fringe and long runs are
    dropped as horizontal walls measured end-on instead of across.

    Measured on the two real sample plans: this returns 12px and 10px, against true
    wall strokes of ~12 and ~10. The MODE is not usable here -- it returns 2px on a
    photographed plan, because JPEG fringing and hatching generate far more 2px runs
    than there are walls, even though the walls dominate total ink.
    """
    limit = max(4, ink.shape[1] // 20)
    lengths = []
    for row in ink:
        padded = np.concatenate(([0], row.astype(np.int8), [0]))
        deltas = np.diff(padded)
        starts = np.flatnonzero(deltas == 1)
        run = np.flatnonzero(deltas == -1) - starts
        run = run[(run >= minimum) & (run <= limit)]
        if run.size:
            lengths.append(run)
    return int(np.percentile(np.concatenate(lengths), percentile)) if lengths else 0


def opening_by_reconstruction(mask: np.ndarray, radius: int) -> np.ndarray:
    """Deletes every shape thinner than 2*radius+1 px and restores the survivors to
    their ORIGINAL thickness. Reuses the 3x3 dilate/erode above, applied radius times --
    an N-iteration 3x3 pass is an N-radius structuring element.

    The regrow step is constrained to the input mask (geodesic reconstruction) rather
    than being a plain dilation, and that distinction is the whole ballgame. A plain
    erode-then-dilate returns walls at roughly their eroded width, which at grid
    resolution drops whole wall segments below the ink-fraction threshold: measured on
    the Unit C1 plan, that punched the building envelope full of holes and left 75% of
    the grid flooded as 'outside' with no interior floor at all. Regrowing into the
    original ink instead brings every wall back to full width while the symbols -- which
    lost their core entirely and have nothing to regrow from -- stay deleted.

    Symbols that physically touch a wall (a door's swing arc meets the wall at its hinge)
    do creep back radius+2 px from the contact point. That is a few pixels against a
    doorway a hundred wide, so it never re-seals the opening.
    """
    core = mask
    for _ in range(radius):
        core = erode(core)
    out = core
    for _ in range(radius + 2):
        out = dilate(out) & mask
    return out


def wall_evidence(image, stroke=None, recover_partitions=True):
    rgb = np.asarray(image.convert('RGB')).astype(np.int16)
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    neutral = rgb.max(axis=2) - rgb.min(axis=2) <= 22
    if not neutral.any():
        raise ValueError('No neutral wall strokes found; use a clear top-down plan.')
    threshold = int(np.clip(otsu_threshold(gray[neutral]), 105, 235))
    # Dark labels can dominate Otsu even when the actual walls have a pale gray
    # fill. Include a substantial neutral midtone mode as a second candidate.
    hist = np.bincount(gray[neutral].ravel(), minlength=256)
    tone = 105 + int(np.argmax(hist[105:236]))
    if hist[tone] >= gray.size * .005:
        threshold = max(threshold, tone)
    ink = (gray <= threshold) & neutral
    # Large gray room fills are not masonry. Keep their dark outlines instead.
    if np.mean(ink & (gray > 105)) > .20:
        ink = gray <= 105
    thickness = stroke if stroke is not None else estimate_stroke_px(ink)
    if thickness < MIN_WALL_STROKE_PX:
        raise ValueError(f'Wall strokes measure only about {thickness}px, too thin to separate '
                         'reliably from annotations; use a larger export.')
    radius = max(1, min(8, round(thickness / 3)))
    structural = opening_by_reconstruction(ink, radius)
    # Exterior walls can be twice as thick as partitions. Retain long, narrower
    # strokes without retaining thin door leaves and furniture outlines.
    narrow = MIN_WALL_STROKE_PX
    length = max(20, thickness * 2)
    partitions = np.zeros_like(ink)
    if recover_partitions:
        for shape in ((narrow, length), (length, narrow)):
            partitions |= cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN,
                                          np.ones(shape, np.uint8)).astype(bool)
    added = partitions & ~structural
    structural |= partitions
    if added.sum() > structural.sum() * .05:
        thickness = min(thickness, estimate_stroke_px(added, 75, MIN_WALL_STROKE_PX) or thickness)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(structural.astype(np.uint8), connectivity=8)
    cleaned = np.zeros_like(ink)
    minimum_span = max(thickness * 4, min(ink.shape) * .045)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if (max(w, h) >= minimum_span and area >= max(w, h) * max(1, thickness * .20)
                or area >= thickness ** 2 * .45):
            cleaned[labels == i] = True
    if not cleaned.any():
        raise ValueError('No structural wall runs found; use a clear top-down plan.')
    return ink, cleaned, thickness


def bridge_wall_gaps(structural, thickness, raw=None, anchor_factor=1.4, mixed_width=False):
    """Connect aligned wall ends, including gaps containing no ink at all.

    Directional anchors prevent joining neighbouring parallel walls across a room.
    All bridges remain explicit opening candidates, never ordinary wall evidence.
    """
    wall = structural.astype(np.uint8)
    max_gap = max(12, round(min(structural.shape[1] * .23, thickness * 24)))
    bridges = np.zeros_like(wall)
    accepted = []
    interior_gap_limit = max(thickness * 12, estimate_stroke_px(structural) * 4) if mixed_width else thickness * 12
    wr, wc = np.where(structural)
    bounds = (wr.min(), wr.max(), wc.min(), wc.max())
    for vertical in (False, True):
        for short_anchor in (False, True):
            anchor = max(5, round(thickness * (.7 if short_anchor else anchor_factor)))
            kernel = np.ones((anchor, 1) if vertical else (1, anchor), np.uint8)
            runs = cv2.morphologyEx(wall, cv2.MORPH_OPEN, kernel)
            close_kernel = np.ones((max_gap, 1) if vertical else (1, max_gap), np.uint8)
            padded = np.pad(runs, max_gap)
            closed = cv2.morphologyEx(padded, cv2.MORPH_CLOSE, close_kernel,
                                      borderType=cv2.BORDER_CONSTANT, borderValue=0)
            closed = closed[max_gap:-max_gap, max_gap:-max_gap]
            candidate = (closed > 0) & ~structural
            # Reject closing fringes alongside an existing solid wall at each
            # longitudinal position, before a frame and fringe can form an L.
            cross = np.ones((1,thickness*2+1) if vertical else (thickness*2+1,1),np.uint8)
            candidate &= ~cv2.dilate(structural.astype(np.uint8),cross).astype(bool)
            if short_anchor:
                if raw is None:
                    continue
                # Short piers are common between windows and beside a door at a T.
                # Demand a frame/leaf line along the gap before grouping patches;
                # otherwise a whole small room can merge with its real doorway.
                gate = np.zeros_like(candidate)
                work = candidate.T if vertical else candidate
                evidence = raw.T if vertical else raw
                allowed = gate.T if vertical else gate
                for row in range(work.shape[0]):
                    padded = np.pad(work[row].astype(np.int8), (1, 1))
                    starts = np.flatnonzero(np.diff(padded) == 1)
                    ends = np.flatnonzero(np.diff(padded) == -1)
                    for start, end in zip(starts, ends):
                        if evidence[row, start:end].mean() >= .50:
                            allowed[row, start:end] = True
                lateral = np.ones((1, max(3, round(thickness))) if vertical else
                                   (max(3, round(thickness)), 1), np.uint8)
                gate = cv2.dilate(gate.astype(np.uint8), lateral).astype(bool)
                # A completely blank opening in the outermost wall still needs an
                # envelope barrier. It will be glass, as all exterior openings are.
                if vertical:
                    gate[:, max(0,bounds[2]-thickness):bounds[2]+round(thickness*1.5)] = True
                    gate[:, bounds[3]-round(thickness*1.5):bounds[3]+thickness+1] = True
                else:
                    gate[max(0,bounds[0]-thickness):bounds[0]+round(thickness*1.5), :] = True
                    gate[bounds[1]-round(thickness*1.5):bounds[1]+thickness+1, :] = True
                candidate &= gate
            n, labels, stats, _ = cv2.connectedComponentsWithStats(candidate.astype(np.uint8), connectivity=8)
            for i in range(1, n):
                x, y, w, h, area = stats[i]
                span, depth = (h, w) if vertical else (w, h)
                if not (thickness * 1.5 <= span <= max_gap and depth <= thickness * 2.5
                        and area >= span * max(1, thickness * .3)):
                    continue
                # Closing with an even pixel kernel can add a fringe beside a
                # continuous wall. A real opening has clear space on its two faces.
                band = max(1, round(thickness * .2))
                if vertical:
                    sides = [structural[y:y+h, max(0,x-band):x],
                             structural[y:y+h, x+w:x+w+band]]
                    covered = [s.any(axis=1).mean() for s in sides if s.size]
                else:
                    sides = [structural[max(0,y-band):y, x:x+w],
                             structural[y+h:y+h+band, x:x+w]]
                    covered = [s.any(axis=0).mean() for s in sides if s.size]
                if covered and max(covered) > .8:
                    continue
                if mixed_width:
                    near_edge = (min(abs(x-bounds[2]), abs(x+w-1-bounds[3])) if vertical else
                                 min(abs(y-bounds[0]), abs(y+h-1-bounds[1]))) <= thickness * 3
                else:
                    near_edge = min(abs(y-bounds[0]), abs(y+h-1-bounds[1]),
                                    abs(x-bounds[2]), abs(x+w-1-bounds[3])) <= thickness * 3
                if mixed_width and raw is not None and not near_edge and span >= thickness * 8:
                    # Inset exterior glazing need not lie on the bounding box.
                    # Parallel rails distinguish a wide window from an open hall.
                    patch = raw[y:y+h, x:x+w]
                    rails = np.flatnonzero(patch.mean(axis=0 if vertical else 1) >= .60)
                    if rails.size > 1 and rails[-1]-rails[0] >= max(3, thickness*.5):
                        near_edge = True
                if not near_edge and span > interior_gap_limit:
                    continue
                accepted.append((span,near_edge,labels==i,x+w/2,y+h/2))
    unique=[]
    for span,edge,_,x,y in accepted:
        if not edge and not any(abs(x-u[1])<thickness and abs(y-u[2])<thickness for u in unique):
            unique.append((span,x,y))
    spans=[u[0] for u in unique]
    cluster=max(([s for s in spans if .8*v<=s<=1.2*v] for v in spans),key=len,default=[])
    typical=float(np.median(cluster)) if len(cluster)>=3 else 0
    for span,edge,component,_,_ in accepted:
        if not edge and typical and span>typical*1.5:
            continue
        bridges[component]=1
    return bridges.astype(bool)


def exterior(mask):
    """All border-connected free regions; images touching an edge are padded."""
    n, labels = cv2.connectedComponents((~mask).astype(np.uint8), connectivity=4)
    border = np.unique(np.concatenate((labels[0],labels[-1],labels[:,0],labels[:,-1])))
    return np.isin(labels,border[border!=0]) & ~mask


def prepare_structure(img):
    warnings = []
    source_size = [int(img.shape[1]), int(img.shape[0])]
    if min(img.shape[:2]) < 64:
        raise ValueError('The image has too few pixels to identify a floor plan.')
    if max(img.shape[:2]) < 750 or min(img.shape[:2]) < 250:
        factor = min(4., 1000 / max(img.shape[:2]))
        img = cv2.resize(img, (round(img.shape[1]*factor),round(img.shape[0]*factor)), interpolation=cv2.INTER_CUBIC)
        warnings.append('The source was enlarged for line extraction. Check the recovered walls and openings against the original.')
        if min(source_size)<250:
            warnings.append('Low-resolution source: small doors and partitions may be missing. Check against the source image.')
    if img.shape[1]>2000:
        factor=2000/img.shape[1]
        img=cv2.resize(img,(2000,round(img.shape[0]*factor)),interpolation=cv2.INTER_AREA)
    img, cropped = colored_building_crop(img)
    if cropped: warnings.append('A colored building footprint was cropped from the surrounding site drawing.')
    method = 'filled_walls'
    image=Image.fromarray(cv2.cvtColor(img,cv2.COLOR_BGR2RGB))
    gray=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    corners=[gray[:15,:15],gray[:15,-15:],gray[-15:,:15],gray[-15:,-15:]]
    if np.mean([c.mean() for c in corners])<90:
        image=ImageOps.invert(image)
    image=ImageOps.expand(image,16,'white')
    try:
        scanned = max(source_size)<750 and np.percentile(gray,90)<250
        raw,wall,stroke=wall_evidence(image,recover_partitions=min(source_size)>=250 and not scanned)
        if stroke < estimate_stroke_px(raw) * .75:
            warnings.append('Thinner partitions were recovered alongside thicker exterior walls. Review the overlay: short partitions and doorways may still be missing.')
        if wall.sum()<raw.sum()*.25 or cropped:
            raise ValueError('Outline extraction required')
    except ValueError:
        work = cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2BGR)
        raw,wall,stroke=outlined_walls(work)
        method = 'paired_outlines'
        warnings.append('Wall outlines were reconstructed from paired lines. Check furniture and wall boundaries in the source overlay.')
    if max(source_size)<750 and np.percentile(gray,90)<250:
        # Reject detached letter/symbol fragments before looking for wall gaps.
        count, labels, stats, _ = cv2.connectedComponentsWithStats(wall.astype(np.uint8))
        major = np.zeros_like(wall)
        for i in range(1,count):
            x,y,w,h,area=stats[i]
            if max(w,h)>=max(stroke*5,min(wall.shape)*.035): major[labels==i]=True
        near = cv2.dilate(major.astype(np.uint8),np.ones((stroke*3+1,)*2,np.uint8)).astype(bool)
        wall &= near
    # Seal sub-stroke raster slits at T-junctions without closing actual doors.
    micro=max(3,stroke+2)
    mask=wall.astype(np.uint8)
    wall=(cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((1,micro),np.uint8)) |
          cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((micro,1),np.uint8))).astype(bool)
    scanned = max(source_size)<750 and np.percentile(gray,90)<250
    mixed_width = method=='filled_walls' and stroke < estimate_stroke_px(raw) * .75
    symbols=raw
    if mixed_width:
        evidence_gray=cv2.cvtColor(np.asarray(image),cv2.COLOR_RGB2GRAY)
        # Pale frame/leaf lines are evidence for an opening, never filled masonry.
        contrast=cv2.dilate(evidence_gray,np.ones((7,7),np.uint8))-evidence_gray
        symbols=raw | ((evidence_gray<235) & (contrast>25))
    gaps=bridge_wall_gaps(wall,stroke,symbols if not scanned else None,3.0 if scanned else 1.4,mixed_width)
    raw_closed=cv2.morphologyEx(raw.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8)).astype(bool)
    outside=exterior(raw_closed)
    raw_boundary=raw_closed & cv2.dilate(outside.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)
    hull=np.zeros_like(wall,dtype=np.uint8)
    cv2.fillConvexPoly(hull,cv2.convexHull(cv2.findNonZero(wall.astype(np.uint8))),1)
    hull_inside=cv2.erode(hull,np.ones((max(3,round(stroke*2)),)*2,np.uint8)).astype(bool)
    raw_boundary &= ~hull_inside
    wall |= raw_boundary
    sealed=cv2.morphologyEx((wall|gaps).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((3,3),np.uint8)).astype(bool)
    outside=exterior(sealed)
    interior=~sealed & ~outside
    if interior.mean()<.02 or sealed.mean()>.55:
        raise ValueError('No reliable enclosed building footprint was found. Use a clear top-down floor plan.')
    n,room_labels,stats,_=cv2.connectedComponentsWithStats(interior.astype(np.uint8),connectivity=4)
    proposals=[]; ambiguous=0
    n,labels,stats_g,_=cv2.connectedComponentsWithStats(gaps.astype(np.uint8),connectivity=8)
    for i in range(1,n):
        x,y,w,h,area=stats_g[i]
        vertical=h>w
        component=labels==i
        # Cover the two rasterized wall faces across the opening.
        band=max(1,round(stroke*.35))
        kernel=np.ones((1,band*2+1) if vertical else (band*2+1,1),np.uint8)
        component=cv2.dilate(component.astype(np.uint8),kernel).astype(bool)&sealed
        neighbour=cv2.dilate(component.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool)
        touches_outside=bool(np.any(neighbour&outside))
        adjacent={int(v) for v in room_labels[neighbour&interior] if v>0 and stats[v,cv2.CC_STAT_AREA]>=100}
        if not touches_outside and len(adjacent)<2:
            sealed[component]=False
            ambiguous+=1
            continue
        # An exterior opening with a perpendicular leaf is an entrance, not glass.
        # Search only at the jambs and require a leaf reaching away from the wall;
        # parallel window frame lines alone cannot satisfy this evidence.
        swing = False
        span = float(h if vertical else w)
        axis = y + h/2 if vertical else x + w/2
        cross = x + w/2 if vertical else y + h/2
        thin_ink = symbols & ~cv2.dilate(wall.astype(np.uint8), np.ones((3,3),np.uint8)).astype(bool)
        ink = thin_ink.T if vertical else thin_ink
        for end in (axis-span/2, axis+span/2):
            lo, hi = max(0, round(end-stroke*.55)), min(ink.shape[1], round(end+stroke*.55+1))
            for sign in (-1, 1):
                ca, cb = sorted((round(cross+sign*stroke*1.5), round(cross+sign*span*.95)))
                ca, cb = max(0,ca), min(ink.shape[0],cb)
                if cb-ca < span*.35 or hi<=lo: continue
                strip = ink[ca:cb,lo:hi].astype(np.uint8)
                leaf = cv2.morphologyEx(strip, cv2.MORPH_OPEN, np.ones((max(3,round(span*.4)),1),np.uint8))
                if np.any(leaf): swing = True
        # Adjacent glazing at a corner can mimic a perpendicular leaf. Two
        # continuous parallel frame rails across the aperture identify glass.
        frame_ink = symbols.T if vertical else symbols
        a, b = max(0,round(axis-span*.4)), min(frame_ink.shape[1],round(axis+span*.4))
        c, d = max(0,round(cross-stroke)), min(frame_ink.shape[0],round(cross+stroke+1))
        rail_rows = np.flatnonzero(frame_ink[c:d,a:b].sum(axis=1) >= (b-a)*.75) if b>a else np.array([])
        framed = rail_rows.size > 1 and float(rail_rows[-1]-rail_rows[0]) >= max(2,stroke*.2)
        proposals.append({'type':'door' if not touches_outside or (swing and not framed) else 'window',
                          'exterior':touches_outside,
                          'x':float(x+w/2-16),'y':float(y+h/2-16),
                          'width':float(h if vertical else w),
                          'orientation':'vertical' if vertical else 'horizontal'})
    doors=sum(p['type']=='door' for p in proposals)
    if ambiguous>max(3,doors):
        warnings.append(f'{ambiguous} ambiguous openings were left unresolved; inspect the source overlay.')
    raw,wall,sealed=raw[16:-16,16:-16],wall[16:-16,16:-16],sealed[16:-16,16:-16]
    # Connected-room validation uses doors as open and exterior glass as solid.
    walk_mask=sealed.copy()
    for op in proposals:
        if op['type']!='door' or op.get('exterior'): continue
        x,y=int(op['x']),int(op['y']); half=int(op['width']/2)+1
        band=max(2,round(stroke*.75))
        if op['orientation']=='horizontal':
            walk_mask[max(0,y-band):y+band+1,max(0,x-half):x+half+1]=False
        else:
            walk_mask[max(0,y-half):y+half+1,max(0,x-band):x+band+1]=False
    floor=~walk_mask & ~exterior(walk_mask)
    n,_,fs,_=cv2.connectedComponentsWithStats(floor.astype(np.uint8),connectivity=4)
    areas=fs[1:,cv2.CC_STAT_AREA]
    reach=float(areas.max()/areas.sum()) if areas.size else 0.
    if reach<.99:
        warnings.append(f'{reach:.0%} of detected floor is connected through readable doors. Some spaces need manual review; no doors were invented.')
    return img,raw.astype(np.uint8)*255,wall.astype(np.uint8)*255,sealed.astype(np.uint8)*255,proposals,stroke,{'warnings':warnings, 'sourceSize':source_size, 'method':method}

