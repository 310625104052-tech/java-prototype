import * as THREE from 'three';
import { FloorPlanData, RoomData } from '../types/floorplan';
import { polygonSlab } from './PolygonGeometry';
import { WallGenerator } from './WallGenerator';
import { DoorGenerator } from './DoorGenerator';
import { WindowGenerator } from './WindowGenerator';
import { ArchitecturalStaging } from './ArchitecturalStaging';
import { batchStaticMeshes } from './batchStaticMeshes';
import { CollisionSystem } from '../navigation/CollisionSystem';

export class FloorPlanRenderer {
  private floorPlanData: FloorPlanData;
  private collisionSystem: CollisionSystem;

  private wallGenerator: WallGenerator;
  private doorGenerator: DoorGenerator;
  private windowGenerator: WindowGenerator;

  public rootGroup: THREE.Group;
  public ceilingGroup: THREE.Group;
  public furnitureGroup: THREE.Group;
  public isCeilingVisible: boolean = true;

  // Cached procedural textures
  private woodTexture?: THREE.CanvasTexture;
  private tileTexture?: THREE.CanvasTexture;
  private marbleTexture?: THREE.CanvasTexture;
  private slateTexture?: THREE.CanvasTexture;

  constructor(floorPlanData: FloorPlanData, collisionSystem: CollisionSystem) {
    this.floorPlanData = floorPlanData;
    this.collisionSystem = collisionSystem;

    this.wallGenerator = new WallGenerator();
    this.doorGenerator = new DoorGenerator();
    this.windowGenerator = new WindowGenerator();

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'floorplan-root';

    this.ceilingGroup = new THREE.Group();
    this.ceilingGroup.name = 'ceiling-group';
    this.rootGroup.add(this.ceilingGroup);

    this.furnitureGroup = new THREE.Group();
    this.furnitureGroup.name = 'furniture-group';
    this.rootGroup.add(this.furnitureGroup);

    this.initTextures();
  }

  private initTextures(): void {
    // 1. Procedural Wood Planks Texture
    const woodCanvas = document.createElement('canvas');
    woodCanvas.width = 512;
    woodCanvas.height = 512;
    const wctx = woodCanvas.getContext('2d')!;
    wctx.fillStyle = '#b88a57';
    wctx.fillRect(0, 0, 512, 512);

    const plankCount = 8;
    const plankH = 512 / plankCount;
    for (let i = 0; i < plankCount; i++) {
      const y = i * plankH;
      const shade = (i % 2 === 0) ? '#be915d' : '#b2834f';
      wctx.fillStyle = shade;
      wctx.fillRect(0, y, 512, plankH);

      // Plank seam line
      wctx.strokeStyle = '#6e4c27';
      wctx.lineWidth = 2;
      wctx.beginPath();
      wctx.moveTo(0, y);
      wctx.lineTo(512, y);
      wctx.stroke();

      // Staggered vertical joints
      const jointX = ((i * 180) % 512);
      wctx.beginPath();
      wctx.moveTo(jointX, y);
      wctx.lineTo(jointX, y + plankH);
      wctx.stroke();
    }
    this.woodTexture = new THREE.CanvasTexture(woodCanvas);
    this.woodTexture.wrapS = THREE.RepeatWrapping;
    this.woodTexture.wrapT = THREE.RepeatWrapping;
    this.woodTexture.repeat.set(3, 3);

    // 2. Procedural Ceramic Tile Texture
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = 512;
    tileCanvas.height = 512;
    const tctx = tileCanvas.getContext('2d')!;
    tctx.fillStyle = '#ded9d2';
    tctx.fillRect(0, 0, 512, 512);

    const tiles = 4;
    const tileStep = 512 / tiles;
    tctx.strokeStyle = '#b8b2a8';
    tctx.lineWidth = 4;
    for (let i = 0; i <= tiles; i++) {
      tctx.beginPath();
      tctx.moveTo(i * tileStep, 0);
      tctx.lineTo(i * tileStep, 512);
      tctx.moveTo(0, i * tileStep);
      tctx.lineTo(512, i * tileStep);
      tctx.stroke();
    }
    this.tileTexture = new THREE.CanvasTexture(tileCanvas);
    this.tileTexture.wrapS = THREE.RepeatWrapping;
    this.tileTexture.wrapT = THREE.RepeatWrapping;
    this.tileTexture.repeat.set(3, 3);

    // 3. Procedural Slate Texture
    const slateCanvas = document.createElement('canvas');
    slateCanvas.width = 512;
    slateCanvas.height = 512;
    const sctx = slateCanvas.getContext('2d')!;
    sctx.fillStyle = '#4f5661';
    sctx.fillRect(0, 0, 512, 512);
    sctx.strokeStyle = '#353a42';
    sctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      sctx.beginPath();
      sctx.moveTo(i * 128, 0);
      sctx.lineTo(i * 128, 512);
      sctx.moveTo(0, i * 128);
      sctx.lineTo(512, i * 128);
      sctx.stroke();
    }
    this.slateTexture = new THREE.CanvasTexture(slateCanvas);
    this.slateTexture.wrapS = THREE.RepeatWrapping;
    this.slateTexture.wrapT = THREE.RepeatWrapping;
    this.slateTexture.repeat.set(2, 4);

    // 4. Marble Texture
    const marbleCanvas = document.createElement('canvas');
    marbleCanvas.width = 512;
    marbleCanvas.height = 512;
    const mctx = marbleCanvas.getContext('2d')!;
    mctx.fillStyle = '#f1f4f8';
    mctx.fillRect(0, 0, 512, 512);
    mctx.strokeStyle = '#d0d7e2';
    mctx.lineWidth = 3;
    for (let i = 0; i <= 3; i++) {
      mctx.beginPath();
      mctx.moveTo(i * 170, 0);
      mctx.lineTo(i * 170, 512);
      mctx.moveTo(0, i * 170);
      mctx.lineTo(512, i * 170);
      mctx.stroke();
    }
    this.marbleTexture = new THREE.CanvasTexture(marbleCanvas);
    this.marbleTexture.wrapS = THREE.RepeatWrapping;
    this.marbleTexture.wrapT = THREE.RepeatWrapping;
    this.marbleTexture.repeat.set(2, 2);
  }

  /**
   * Builds the entire 3D building from the structured floor plan data.
   */
  public build(): void {
    // 1. Clear previous collision obstacles
    this.collisionSystem.clear();
    const b = this.floorPlanData.bounds;
    this.collisionSystem.setBounds(b.minX, b.minY, b.maxX, b.maxY);

    // 2. Build Floor
    this.buildFloors();

    // 3. Build Walls (with door & window openings)
    this.buildWalls();

    // 4. Build Doors
    this.buildDoors();

    // 5. Build Windows
    this.buildWindows();

    // 6. Build Ceiling & Roof
    this.buildCeiling();

    // 7. Build Architectural Minimalist Furniture & Staging
    if (this.floorPlanData.source !== 'detected') this.buildArchitecturalStaging();
  }

  private buildFloors(): void {
    const { bounds, rooms, shell } = this.floorPlanData;
    if (shell) {
      const material = new THREE.MeshStandardMaterial({color: 0xded9d2, roughness: .8});
      for (const polygon of shell.footprint) {
        const floor = new THREE.Mesh(polygonSlab(polygon, -.16, .16), material);
        floor.name = 'footprint-floor';
        floor.receiveShadow = true;
        this.rootGroup.add(floor);
      }
      // Use actual room polygons: concave rooms must never become overlapping rectangles.
      for (const room of rooms) {
        if (!room.polygon || room.polygon.length < 3) continue;
        const floor = new THREE.Mesh(polygonSlab({outer: room.polygon, holes: []}, 0, .008), material);
        floor.name = `floor-${room.id}`;
        floor.receiveShadow = true;
        this.rootGroup.add(floor);
      }
      return;
    }
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;

    // Foundation Sub-Floor Slab
    const foundationGeom = new THREE.BoxGeometry(width + 2.0, 0.2, depth + 2.0);
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x2d3238,
      roughness: 0.9,
      metalness: 0.1,
    });
    const foundationMesh = new THREE.Mesh(foundationGeom, foundationMat);
    foundationMesh.position.set(
      bounds.minX + width / 2,
      -0.1,
      bounds.minY + depth / 2
    );
    foundationMesh.name = 'foundation-slab';
    foundationMesh.receiveShadow = true;
    this.rootGroup.add(foundationMesh);

    // Outer lawn / paved terrace
    const groundGeom = new THREE.PlaneGeometry(width + 30, depth + 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d4a36, // deep architectural garden grass tone
      roughness: 0.95,
      metalness: 0.0,
    });
    const groundMesh = new THREE.Mesh(groundGeom, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(bounds.minX + width / 2, -0.2, bounds.minY + depth / 2);
    groundMesh.receiveShadow = true;
    this.rootGroup.add(groundMesh);

    // Front walkway pavers
    const pathGeom = new THREE.BoxGeometry(2.4, 0.02, 4.0);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.8 });
    const pathMesh = new THREE.Mesh(pathGeom, pathMat);
    // Match the finished floor: coplanar paving and foundation tops cause z-fighting.
    pathMesh.position.set(7.5, 0.01, -2.0);
    pathMesh.name = 'entrance-walkway';
    pathMesh.receiveShadow = true;
    this.rootGroup.add(pathMesh);

    // Room-specific finished floors
    for (const room of rooms) {
      const roomFloorGeom = new THREE.BoxGeometry(room.width, 0.02, room.height);
      let floorMat: THREE.MeshStandardMaterial;

      switch (room.floorType) {
        case 'hardwood':
          floorMat = new THREE.MeshStandardMaterial({
            map: this.woodTexture,
            roughness: 0.45,
            metalness: 0.1,
          });
          break;
        case 'ceramic':
          floorMat = new THREE.MeshStandardMaterial({
            map: this.tileTexture,
            roughness: 0.35,
            metalness: 0.05,
          });
          break;
        case 'slate':
          floorMat = new THREE.MeshStandardMaterial({
            map: this.slateTexture,
            roughness: 0.6,
            metalness: 0.15,
          });
          break;
        case 'marble':
          floorMat = new THREE.MeshStandardMaterial({
            map: this.marbleTexture,
            roughness: 0.2,
            metalness: 0.1,
          });
          break;
        default:
          floorMat = new THREE.MeshStandardMaterial({
            color: room.color || 0xdedede,
            roughness: 0.6,
          });
      }

      const roomFloor = new THREE.Mesh(roomFloorGeom, floorMat);
      // Position center of room
      roomFloor.position.set(
        room.x + room.width / 2,
        0.01,
        room.y + room.height / 2
      );
      roomFloor.receiveShadow = true;
      this.rootGroup.add(roomFloor);
    }
  }

  private buildWalls(): void {
    const { walls, doors, windows, defaultWallHeight, shell } = this.floorPlanData;
    if (shell) {
      const group = new THREE.Group();
      group.name = 'connected-wall-shell';
      const material = new THREE.MeshStandardMaterial({color: 0xf1efe9, roughness: .85});
      for (const layer of shell.layers) {
        for (const polygon of layer.polygons) {
          const mesh = new THREE.Mesh(polygonSlab(polygon, layer.bottom, layer.top-layer.bottom), material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
      for (const polygon of shell.collision) {
        for (const ring of [polygon.outer, ...polygon.holes]) {
          ring.forEach(([x, y], i) => {
            const next = ring[(i+1)%ring.length];
            this.collisionSystem.addObstacle(x, y, next[0], next[1], .001);
          });
        }
      }
      batchStaticMeshes(group);
      this.rootGroup.add(group);
      return;
    }

    const wallsGroup = new THREE.Group();
    wallsGroup.name = 'walls-collection';

    for (const wall of walls) {
      const wallMeshGroup = this.wallGenerator.generateWall(
        wall,
        doors,
        windows,
        defaultWallHeight,
        this.collisionSystem
      );
      wallsGroup.add(wallMeshGroup);
    }

    batchStaticMeshes(wallsGroup);
    this.rootGroup.add(wallsGroup);
  }

  private buildDoors(): void {
    const { doors } = this.floorPlanData;
    const doorsGroup = new THREE.Group();
    doorsGroup.name = 'doors-collection';

    for (const door of doors) {
      const doorMesh = this.doorGenerator.generateDoor(door);
      doorsGroup.add(doorMesh);
    }

    batchStaticMeshes(doorsGroup);
    this.rootGroup.add(doorsGroup);
  }

  private buildWindows(): void {
    const { windows } = this.floorPlanData;
    const windowsGroup = new THREE.Group();
    windowsGroup.name = 'windows-collection';

    for (const win of windows) {
      const winMesh = this.windowGenerator.generateWindow(win);
      windowsGroup.add(winMesh);
    }

    batchStaticMeshes(windowsGroup);
    this.rootGroup.add(windowsGroup);
  }

  private buildCeiling(): void {
    const { bounds, defaultWallHeight, rooms, shell } = this.floorPlanData;
    if (shell) {
      const material = new THREE.MeshStandardMaterial({color: 0xfcfbfa, roughness: .85});
      for (const polygon of shell.footprint) {
        const roof = new THREE.Mesh(polygonSlab(polygon, defaultWallHeight, .15), material);
        roof.castShadow = true;
        roof.receiveShadow = true;
        this.ceilingGroup.add(roof);
      }
      return;
    }
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;
    const thickness = 0.15;

    // Main roof / ceiling slab
    const ceilingGeom = new THREE.BoxGeometry(width + 0.5, thickness, depth + 0.5);
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xfcfbfa,
      roughness: 0.85,
      metalness: 0.05,
    });
    const ceilingMesh = new THREE.Mesh(ceilingGeom, ceilingMat);
    ceilingMesh.position.set(
      bounds.minX + width / 2,
      defaultWallHeight + thickness / 2,
      bounds.minY + depth / 2
    );
    ceilingMesh.castShadow = true;
    ceilingMesh.receiveShadow = true;
    this.ceilingGroup.add(ceilingMesh);

    // Recessed warm ceiling lights for each room
    const lightFixtureMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf5,
      emissive: 0xfffaed,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });

    for (const room of rooms) {
      const fixtureGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16);
      const fixtureMesh = new THREE.Mesh(fixtureGeom, lightFixtureMat);
      fixtureMesh.position.set(
        room.x + room.width / 2,
        defaultWallHeight - 0.015,
        room.y + room.height / 2
      );
      this.ceilingGroup.add(fixtureMesh);
    }

    // Consolidated regional interior warm fill lights (capped at 2 to keep shaders at locked 60 FPS)
    const midX = bounds.minX + width / 2;
    const northZ = bounds.minY + depth * 0.28;
    const southZ = bounds.minY + depth * 0.72;

    const northLight = new THREE.PointLight(0xfff1dc, 1.6, Math.max(width, depth), 1.2);
    northLight.position.set(midX, defaultWallHeight - 0.25, northZ);
    northLight.castShadow = false;

    const southLight = new THREE.PointLight(0xfff1dc, 1.6, Math.max(width, depth), 1.2);
    southLight.position.set(midX, defaultWallHeight - 0.25, southZ);
    southLight.castShadow = false;

    this.ceilingGroup.add(northLight, southLight);
  }

  public dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.rootGroup.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    for (const texture of [this.woodTexture, this.tileTexture, this.marbleTexture, this.slateTexture]) {
      if (texture) textures.add(texture);
    }
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    textures.forEach(t => t.dispose());
  }

  public setCeilingVisible(visible: boolean): void {
    this.isCeilingVisible = visible;
    this.ceilingGroup.visible = visible;
  }

  public toggleCeiling(): boolean {
    this.setCeilingVisible(!this.isCeilingVisible);
    return this.isCeilingVisible;
  }

  /**
   * Builds procedural 3D room furnishings, architectural signage, and wayfinding.
   */
  private buildArchitecturalStaging(): void {
    // Clear any previous furniture
    while (this.furnitureGroup.children.length > 0) {
      this.furnitureGroup.remove(this.furnitureGroup.children[0]);
    }
    const staging = new ArchitecturalStaging(this.floorPlanData, this.furnitureGroup, this.collisionSystem);
    staging.build();
    for (const room of this.furnitureGroup.children) {
      if (room instanceof THREE.Group) batchStaticMeshes(room);
    }
  }
}
