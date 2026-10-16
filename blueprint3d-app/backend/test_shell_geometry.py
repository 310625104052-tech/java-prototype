"""Geometric regressions: connected wall caps, room holes and exact openings."""
import unittest
import cv2
import numpy as np
from shell_geometry import build_shell, polygons


def rasterize(shapes, size):
    mask = np.zeros(size, np.uint8)
    for shape in shapes:
        part = np.zeros(size, np.uint8)
        # OpenCV hole contours trace the wall side of the boundary; drawContours
        # with hierarchy uses even/odd fill and preserves the original raster.
        rings = [np.array(shape['outer'], np.int32)] + [np.array(h, np.int32) for h in shape['holes']]
        cv2.fillPoly(part, rings, 255)
        mask |= part
    return mask


class ShellGeometryTests(unittest.TestCase):
    def setUp(self):
        self.mask = np.zeros((300, 400), np.uint8)
        cv2.rectangle(self.mask, (30, 30), (370, 270), 255, 10)
        cv2.line(self.mask, (220, 30), (220, 270), 255, 10)
        self.openings = [
            {'type':'door', 'x':220., 'y':150., 'width':50., 'orientation':'vertical'},
            {'type':'window', 'x':100., 'y':30., 'width':60., 'orientation':'horizontal'},
        ]

    def test_contours_preserve_rooms_as_holes(self):
        shapes = polygons(self.mask)
        self.assertEqual(len(shapes), 1)
        self.assertEqual(len(shapes[0]['holes']), 2)
        rebuilt = rasterize(shapes, self.mask.shape)
        iou = np.count_nonzero((rebuilt>0)&(self.mask>0))/np.count_nonzero((rebuilt>0)|(self.mask>0))
        self.assertGreater(iou, .98)

    def test_slices_keep_corners_and_cut_only_opening_heights(self):
        shell = build_shell(self.mask, self.openings, 11)
        layers = [rasterize(l['polygons'], self.mask.shape) for l in shell['layers']]
        self.assertEqual(len(shell['layers'][-1]['polygons']), 1)
        for layer in layers:
            self.assertEqual(layer[30, 30], 255)
        self.assertEqual(layers[0][150,220], 0)   # door at ground
        self.assertEqual(layers[0][30,100], 255)  # window sill
        self.assertEqual(layers[1][30,100], 0)    # glass aperture
        self.assertEqual(layers[2][150,220], 255) # door lintel
        self.assertEqual(layers[3][30,100], 255)  # window lintel
        self.assertEqual(shell['collision'], shell['layers'][0]['polygons'])
        x, y = map(round, shell['spawn'].values())
        self.assertEqual(self.mask[y,x], 0)

    def test_detached_outside_annotations_do_not_become_towers(self):
        cv2.rectangle(self.mask, (390, 1), (399, 15), 255, -1)
        shell = build_shell(self.mask, self.openings, 11)
        self.assertEqual(len(shell['footprint']), 1)
        self.assertLess(max(p[0] for p in shell['footprint'][0]['outer']), 390)


if __name__ == '__main__':
    unittest.main()
