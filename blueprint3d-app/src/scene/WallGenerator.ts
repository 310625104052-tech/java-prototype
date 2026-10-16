import * as THREE from 'three';
import { WallData, DoorData, WindowData } from '../types/floorplan';
import { CollisionSystem } from '../navigation/CollisionSystem';

interface OpeningInterval {
  type: 'door' | 'window';
  id: string;
  sStart: number;
  sEnd: number;
  data: DoorData | WindowData;
}

export class WallGenerator {
  private exteriorWallMaterial: THREE.MeshStandardMaterial;
  private interiorWallMaterial: THREE.MeshStandardMaterial;
  private baseboardMaterial: THREE.MeshStandardMaterial;

  constructor() {
    // Professional architectural materials
    this.exteriorWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xddd7cc,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.interiorWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1efe9,
      roughness: 0.9,
      metalness: 0.02,
    });

    this.baseboardMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1,
    });
  }

  /**
   * Generates 3D wall segments for a wall, taking doors and windows into account.
   */
  public generateWall(
    wall: WallData,
    doors: DoorData[],
    windows: WindowData[],
    defaultHeight: number,
    collisionSystem: CollisionSystem
  ): THREE.Group {
    const wallGroup = new THREE.Group();
    wallGroup.name = `wall-${wall.id}`;

    const height = wall.height || defaultHeight;
    const thickness = wall.thickness || 0.2;
    const isExterior = wall.type === 'exterior';
    const material = isExterior ? this.exteriorWallMaterial : this.interiorWallMaterial;

    const dx = wall.x2 - wall.x1;
    const dz = wall.y2 - wall.y1; // in blueprint Y maps to Three.js Z
    const wallLength = Math.hypot(dx, dz);

    if (wallLength < 0.05) return wallGroup;

    // Unit vector along the wall direction
    const ux = dx / wallLength;
    const uz = dz / wallLength;

    // Wall rotation around Y axis in Three.js coordinates
    const wallAngle = Math.atan2(dz, dx);

    // Find all openings on this wall
    const intervals: OpeningInterval[] = [];

    // Check doors
    for (const door of doors) {
      if (door.wallId ? door.wallId === wall.id : ((door.orientation === 'vertical') === (Math.abs(dz) > Math.abs(dx)) && this.isPointOnSegment(door.x, door.y, wall.x1, wall.y1, wall.x2, wall.y2, thickness / 2))) {
        const s = (door.x - wall.x1) * ux + (door.y - wall.y1) * uz;
        const halfW = door.width / 2;
        intervals.push({
          type: 'door',
          id: door.id,
          sStart: Math.max(0, s - halfW),
          sEnd: Math.min(wallLength, s + halfW),
          data: door,
        });
      }
    }

    // Check windows
    for (const win of windows) {
      if (win.wallId ? win.wallId === wall.id : ((win.orientation === 'vertical') === (Math.abs(dz) > Math.abs(dx)) && this.isPointOnSegment(win.x, win.y, wall.x1, wall.y1, wall.x2, wall.y2, thickness / 2))) {
        const s = (win.x - wall.x1) * ux + (win.y - wall.y1) * uz;
        const halfW = win.width / 2;
        intervals.push({
          type: 'window',
          id: win.id,
          sStart: Math.max(0, s - halfW),
          sEnd: Math.min(wallLength, s + halfW),
          data: win,
        });
      }
    }

    for (let i = intervals.length - 1; i >= 0; i--) {
      if (intervals[i].sEnd <= intervals[i].sStart) intervals.splice(i, 1);
    }

    // Sort intervals along wall parameter s
    intervals.sort((a, b) => a.sStart - b.sStart);

    // Merge overlapping intervals if any
    const mergedIntervals: OpeningInterval[] = [];
    for (const curr of intervals) {
      if (mergedIntervals.length === 0) {
        mergedIntervals.push(curr);
      } else {
        const prev = mergedIntervals[mergedIntervals.length - 1];
        if (curr.sStart < prev.sEnd) {
          prev.sEnd = Math.max(prev.sEnd, curr.sEnd);
        } else {
          mergedIntervals.push(curr);
        }
      }
    }

    // Generate solid wall sections between openings
    let currentS = 0;
    for (const opening of mergedIntervals) {
      if (opening.sStart > currentS + 0.02) {
        // Solid wall segment
        this.createSolidWallSegment(
          wall,
          currentS,
          opening.sStart,
          height,
          thickness,
          ux,
          uz,
          wallAngle,
          material,
          wallGroup,
          collisionSystem
        );
      }

      // Generate above/below opening segments
      if (opening.type === 'door') {
        const door = opening.data as DoorData;
        const doorHeight = door.height || 2.1;
        const lintelHeight = Math.max(0, height - doorHeight);

        if (lintelHeight > 0.05) {
          // Lintel segment over door
          this.createSegmentMesh(
            opening.sStart,
            opening.sEnd,
            doorHeight,
            lintelHeight,
            thickness,
            wall,
            ux,
            uz,
            wallAngle,
            material,
            wallGroup,
            false // no ground collision needed since player walks underneath
          );
        }
      } else if (opening.type === 'window') {
        const win = opening.data as WindowData;
        const sillHeight = win.sillHeight || 0.9;
        const winHeight = win.height || 1.2;
        const lintelY = sillHeight + winHeight;
        const lintelHeight = Math.max(0, height - lintelY);

        // 1. Sill wall beneath window (blocks player movement)
        if (sillHeight > 0.05) {
          const sillMesh = this.createSegmentMesh(
            opening.sStart,
            opening.sEnd,
            0,
            sillHeight,
            thickness,
            wall,
            ux,
            uz,
            wallAngle,
            material,
            wallGroup,
            true
          );

          // Add sill to collision system so player cannot walk through window opening
          collisionSystem.addObstacle(
            wall.x1 + ux * opening.sStart,
            wall.y1 + uz * opening.sStart,
            wall.x1 + ux * opening.sEnd,
            wall.y1 + uz * opening.sEnd,
            thickness
          );
        }

        // 2. Lintel above window
        if (lintelHeight > 0.05) {
          this.createSegmentMesh(
            opening.sStart,
            opening.sEnd,
            lintelY,
            lintelHeight,
            thickness,
            wall,
            ux,
            uz,
            wallAngle,
            material,
            wallGroup,
            false
          );
        }
      }

      currentS = opening.sEnd;
    }

    // Remaining solid wall to the end of the wall
    if (wallLength > currentS + 0.02) {
      this.createSolidWallSegment(
        wall,
        currentS,
        wallLength,
        height,
        thickness,
        ux,
        uz,
        wallAngle,
        material,
        wallGroup,
        collisionSystem
      );
    }

    return wallGroup;
  }

  private createSolidWallSegment(
    wall: WallData,
    sStart: number,
    sEnd: number,
    height: number,
    thickness: number,
    ux: number,
    uz: number,
    wallAngle: number,
    material: THREE.Material,
    parentGroup: THREE.Group,
    collisionSystem: CollisionSystem
  ): void {
    const segLength = sEnd - sStart;
    if (segLength < 0.01) return;

    this.createSegmentMesh(
      sStart,
      sEnd,
      0,
      height,
      thickness,
      wall,
      ux,
      uz,
      wallAngle,
      material,
      parentGroup,
      true
    );

    // Register with collision system
    const p1x = wall.x1 + ux * sStart;
    const p1z = wall.y1 + uz * sStart;
    const p2x = wall.x1 + ux * sEnd;
    const p2z = wall.y1 + uz * sEnd;
    collisionSystem.addObstacle(p1x, p1z, p2x, p2z, thickness);

    // Add subtle architectural baseboard
    const baseboardHeight = 0.09;
    const baseboardThickness = thickness + 0.02;
    const baseboardGeom = new THREE.BoxGeometry(segLength, baseboardHeight, baseboardThickness);
    const baseboardMesh = new THREE.Mesh(baseboardGeom, this.baseboardMaterial);
    baseboardMesh.castShadow = true;
    baseboardMesh.receiveShadow = true;

    const midS = (sStart + sEnd) / 2;
    baseboardMesh.position.set(
      wall.x1 + ux * midS,
      baseboardHeight / 2,
      wall.y1 + uz * midS
    );
    baseboardMesh.rotation.y = -wallAngle;
    parentGroup.add(baseboardMesh);
  }

  private createSegmentMesh(
    sStart: number,
    sEnd: number,
    bottomY: number,
    blockHeight: number,
    thickness: number,
    wall: WallData,
    ux: number,
    uz: number,
    wallAngle: number,
    material: THREE.Material,
    parentGroup: THREE.Group,
    castShadow: boolean = true
  ): THREE.Mesh {
    const segLength = sEnd - sStart;
    const geom = new THREE.BoxGeometry(segLength, blockHeight, thickness);
    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;

    const midS = (sStart + sEnd) / 2;
    mesh.position.set(
      wall.x1 + ux * midS,
      bottomY + blockHeight / 2,
      wall.y1 + uz * midS
    );
    mesh.rotation.y = -wallAngle;

    parentGroup.add(mesh);
    return mesh;
  }

  private isPointOnSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tolerance: number
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return false;

    const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (t < -0.05 || t > 1.05) return false;

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);
    return distSq <= tolerance * tolerance;
  }
}
