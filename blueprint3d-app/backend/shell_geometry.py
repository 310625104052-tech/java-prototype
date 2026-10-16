"""Export the connected wall footprint, including holes, for mesh extrusion.

Hough centerlines are useful annotations, but never a watertight building mesh.
All height slices and navigation boundaries here share the same raster topology.
"""
import cv2
import numpy as np


def polygons(mask, epsilon=.65):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return []
    def ring(index):
        return cv2.approxPolyDP(contours[index], epsilon, True).reshape(-1, 2).astype(float).tolist()
    result = []
    for i, entry in enumerate(hierarchy[0]):
        if entry[3] != -1 or cv2.contourArea(contours[i]) < 2:
            continue
        holes = []
        child = int(entry[2])
        while child != -1:
            if cv2.contourArea(contours[child]) >= 2:
                holes.append(ring(child))
            child = int(hierarchy[0][child][0])
        outer = ring(i)
        if len(outer) >= 3:
            result.append({'outer': outer, 'holes': holes})
    return result


def build_shell(topology, openings, stroke):
    # Remove disconnected annotations outside the actual building envelope.
    # Keep internal islands (columns/pillars), which may legitimately be detached.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(topology)
    if count > 1:
        main = (labels == (1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])))).astype(np.uint8)*255
        boundary, _ = cv2.findContours(main, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        envelope = np.zeros_like(topology)
        cv2.drawContours(envelope, boundary, -1, 255, -1)
        topology = cv2.bitwise_and(topology, envelope)
    cuts = []
    for op in openings:
        mask = np.zeros_like(topology)
        x, y = op['x'], op['y']
        half = op['width'] / 2
        band = max(2, stroke * 1.1)
        if op['orientation'] == 'horizontal':
            box = (x-half, y-band, x+half, y+band)
        else:
            box = (x-band, y-half, x+band, y+half)
        # Keep axial bounds consistent with the frame's actual width.
        cv2.rectangle(mask, (round(box[0]), round(box[1])), (round(box[2]), round(box[3])), 255, -1)
        cuts.append((op, mask))
    layers = []
    for bottom, top in [(0., .9), (.9, 2.3), (2.3, 2.4), (2.4, 3.2)]:
        mask = topology.copy()
        for op, cut in cuts:
            sill = .9 if op['type'] == 'window' else 0.
            head = 2.4 if op['type'] == 'window' else 2.3
            if bottom >= sill and top <= head + 1e-6:
                mask[cut > 0] = 0
        layers.append({'bottom': bottom, 'top': top, 'polygons': polygons(mask)})
    # The ground-floor slice includes window sills and excludes doors. It is also
    # the collision boundary, rather than the fragmented diagnostic centerlines.
    collision = layers[0]['polygons']
    footprint_mask = topology.copy()
    contours, _ = cv2.findContours(topology, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(footprint_mask, contours, -1, 255, -1)
    free = cv2.bitwise_not(topology)
    count, labels = cv2.connectedComponents(free)
    border = set(np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))))
    interior = np.isin(labels, [i for i in range(1, count) if i not in border]).astype(np.uint8)
    clearance = cv2.distanceTransform(interior, cv2.DIST_L2, 5)
    _, _, _, point = cv2.minMaxLoc(clearance)
    return {'layers': layers, 'collision': collision, 'footprint': polygons(footprint_mask),
            'spawn': {'x': float(point[0]), 'y': float(point[1])}}
