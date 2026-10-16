import * as THREE from 'three';
import { PlanPolygon } from '../types/floorplan';

/** Blueprint (x,y) maps to world (x,z); negate shape Y before rotating it. */
export function polygonShape(polygon: PlanPolygon): THREE.Shape {
  const shape = new THREE.Shape(polygon.outer.map(([x, y]) => new THREE.Vector2(x, -y)));
  for (const hole of polygon.holes) {
    shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, -y))));
  }
  return shape;
}

export function polygonSlab(polygon: PlanPolygon, bottom: number, height: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(polygonShape(polygon), {
    depth: height, bevelEnabled: false, steps: 1, curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}
