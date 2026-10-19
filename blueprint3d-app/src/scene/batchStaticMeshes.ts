import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batch fixed furnishings per room, preserving materials, world placement and shadows. */
export function batchStaticMeshes(room: THREE.Group): void {
  room.updateWorldMatrix(true, true);
  const inverse = room.matrixWorld.clone().invert();
  const batches = new Map<string, THREE.Mesh[]>();
  room.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object.material.transparent) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const meshes = batches.get(key) || [];
    meshes.push(object);
    batches.set(key, meshes);
  });
  let batchIndex = 0;
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(item => item.dispose());
    if (!geometry) continue;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry, meshes[0].material);
    batch.name = `static-batch-${room.name}-${batchIndex++}`;
    batch.castShadow = meshes[0].castShadow;
    batch.receiveShadow = meshes[0].receiveShadow;
    for (const mesh of meshes) mesh.removeFromParent();
    room.add(batch);
  }
}
