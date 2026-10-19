import * as THREE from 'three';
import { FloorPlanData, RoomData, DoorData } from '../types/floorplan';
import { CollisionSystem } from '../navigation/CollisionSystem';

/**
 * Procedural architectural staging engine.
 * Generates realistic college furniture, 3D room signage, stairwells, and wayfinding.
 */
export class ArchitecturalStaging {
  private floorPlan: FloorPlanData;
  private parentGroup: THREE.Group;
  private collisionSystem: CollisionSystem;

  // Reusable materials
  private oakWoodMat: THREE.MeshStandardMaterial;
  private metalFrameMat: THREE.MeshStandardMaterial;
  private stainlessRailMat: THREE.MeshStandardMaterial;
  private darkPlasticMat: THREE.MeshStandardMaterial;
  private whiteboardMat: THREE.MeshStandardMaterial;
  private concreteStairMat: THREE.MeshStandardMaterial;
  private labSurfaceMat: THREE.MeshStandardMaterial;
  private fabricSeatMat: THREE.MeshStandardMaterial;

  constructor(floorPlan: FloorPlanData, parentGroup: THREE.Group, collisionSystem: CollisionSystem) {
    this.floorPlan = floorPlan;
    this.parentGroup = parentGroup;
    this.collisionSystem = collisionSystem;

    this.oakWoodMat = new THREE.MeshStandardMaterial({
      color: 0x966842,
      roughness: 0.5,
      metalness: 0.05,
    });

    this.metalFrameMat = new THREE.MeshStandardMaterial({
      color: 0x22262b,
      roughness: 0.4,
      metalness: 0.7,
    });

    this.stainlessRailMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde4,
      roughness: 0.2,
      metalness: 0.9,
    });

    this.darkPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.6,
      metalness: 0.2,
    });

    this.whiteboardMat = new THREE.MeshStandardMaterial({
      color: 0xf4f6f8,
      roughness: 0.15,
      metalness: 0.1,
    });

    this.concreteStairMat = new THREE.MeshStandardMaterial({
      color: 0x6e7681,
      roughness: 0.8,
      metalness: 0.1,
    });

    this.labSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6, // ESD anti-static technical blue
      roughness: 0.35,
      metalness: 0.1,
    });

    this.fabricSeatMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.0,
    });
  }

  public build(): void {
    // 1. Build 3D Architectural Door Signage
    this.buildDoorSignage();

    // 2. Build Staircases in Stairwells
    this.buildStaircases();

    // 3. Build Room-Specific Architectural Furnishings
    this.buildRoomStaging();
  }

  /**
   * Generates crisp 3D architectural signage above or beside doors.
   */
  private buildDoorSignage(): void {
    const { doors, defaultWallHeight } = this.floorPlan;
    const signHeight = 0.24;
    const signDepth = 0.025;

    for (const door of doors) {
      const doorTitle = door.name || 'FACILITY';
      const signWidth = Math.max(0.75, Math.min(1.4, door.width * 0.75));

      // Create high-res canvas texture
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;

      // Background plate: dark brushed graphite
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 512, 128);

      // Border frame
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 504, 120);

      // Inner accent line
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 492, 108);

      // Text rendering
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(doorTitle.toUpperCase(), 256, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const signMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.3,
        metalness: 0.2,
      });

      const signGeom = new THREE.BoxGeometry(signWidth, signHeight, signDepth);
      const signMesh = new THREE.Mesh(signGeom, signMat);

      const doorH = door.height || 2.1;
      const posY = Math.min(defaultWallHeight - 0.25, doorH + signHeight / 2 + 0.15);

      signMesh.position.set(door.x, posY, door.y);
      if (door.orientation === 'vertical') {
        signMesh.rotation.y = Math.PI / 2;
      }

      this.parentGroup.add(signMesh);
    }
  }

  /**
   * Generates realistic 3D concrete stairs with stainless steel handrails.
   */
  private buildStaircases(): void {
    const { rooms, stairs } = this.floorPlan;
    const stairRooms = rooms.filter((r) => r.type === 'stairs' || r.name.toLowerCase().includes('stair'));

    for (const room of stairRooms) {
      const stairGroup = new THREE.Group();
      stairGroup.name = `stairs-${room.id}`;

      const flightWidth = Math.min(1.5, (room.width - 0.6) / 2);
      const stepCount = 10;
      const stepHeight = 0.16;
      const stepDepth = 0.28;

      // Flight 1 (Going up from floor)
      const startX = room.x + 0.4;
      const startZ = room.y + 0.4;

      for (let i = 0; i < stepCount; i++) {
        const stepGeom = new THREE.BoxGeometry(flightWidth, stepHeight * (i + 1), stepDepth);
        const stepMesh = new THREE.Mesh(stepGeom, this.concreteStairMat);
        stepMesh.position.set(
          startX + flightWidth / 2,
          (stepHeight * (i + 1)) / 2,
          startZ + i * stepDepth + stepDepth / 2
        );
        stepMesh.castShadow = true;
        stepMesh.receiveShadow = true;
        stairGroup.add(stepMesh);
      }

      // Handrail on outside
      const railGeom = new THREE.CylinderGeometry(0.025, 0.025, stepCount * stepDepth * 1.25, 8);
      const handrail = new THREE.Mesh(railGeom, this.stainlessRailMat);
      handrail.rotation.x = Math.PI / 4;
      handrail.position.set(
        startX + flightWidth,
        (stepCount * stepHeight) / 2 + 0.9,
        startZ + (stepCount * stepDepth) / 2
      );
      stairGroup.add(handrail);

      // Intermediate Landing
      const landingDepth = 1.2;
      const landingHeight = stepCount * stepHeight;
      const landingGeom = new THREE.BoxGeometry(room.width - 0.8, landingHeight, landingDepth);
      const landingMesh = new THREE.Mesh(landingGeom, this.concreteStairMat);
      landingMesh.position.set(
        room.x + room.width / 2,
        landingHeight / 2,
        startZ + stepCount * stepDepth + landingDepth / 2
      );
      landingMesh.castShadow = true;
      landingMesh.receiveShadow = true;
      stairGroup.add(landingMesh);

      this.parentGroup.add(stairGroup);
    }
  }

  /**
   * Dispatches room furniture staging based on architectural function.
   */
  private buildRoomStaging(): void {
    const { rooms } = this.floorPlan;

    for (const room of rooms) {
      const lower = room.name.toLowerCase();
      const roomType = room.type || '';

      if (lower.includes('lecture') || roomType === 'classroom') {
        this.stageLectureHall(room);
      } else if (lower.includes('robotics') || (lower.includes('lab') && lower.includes('ai'))) {
        this.stageRoboticsLab(room);
      } else if (lower.includes('electronic') || roomType === 'lab') {
        this.stageElectronicsLab(room);
      } else if (lower.includes('office') || roomType === 'office') {
        this.stageFacultyOffice(room);
      } else if (lower.includes('seminar') || roomType === 'seminar') {
        this.stageSeminarRoom(room);
      } else if (lower.includes('corridor') || roomType === 'corridor') {
        this.stageCorridor(room);
      } else if (lower.includes('living')) {
        this.stageResidentialLiving(room);
      } else if (lower.includes('bedroom')) {
        this.stageResidentialBedroom(room);
      } else if (lower.includes('kitchen')) {
        this.stageResidentialKitchen(room);
      }
    }
  }

  /**
   * Lecture Hall: stadium/tiered seating, lecture desks, presenter podium, front board.
   */
  private stageLectureHall(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // 1. Front Presentation Wall Smart Screen (on North wall, y=room.y + 0.1)
    const screenGeom = new THREE.BoxGeometry(5.0, 1.8, 0.05);
    const screenMesh = new THREE.Mesh(screenGeom, this.darkPlasticMat);
    screenMesh.position.set(room.x + room.width / 2, 1.8, room.y + 0.1);
    group.add(screenMesh);

    // Front Whiteboard beside it
    const boardGeom = new THREE.BoxGeometry(3.2, 1.5, 0.03);
    const boardMesh = new THREE.Mesh(boardGeom, this.whiteboardMat);
    boardMesh.position.set(room.x + room.width / 2 - 4.5, 1.8, room.y + 0.1);
    group.add(boardMesh);

    // 2. Instructor Lectern / Podium
    const podiumGeom = new THREE.BoxGeometry(1.0, 1.15, 0.65);
    const podium = new THREE.Mesh(podiumGeom, this.oakWoodMat);
    podium.position.set(room.x + room.width / 2 + 3.2, 0.575, room.y + 1.6);
    podium.castShadow = true;
    group.add(podium);

    // 3. Student Desk Rows (3 rows)
    const rows = 3;
    const desksPerRow = 3;
    const deskWidth = 3.2;
    const deskDepth = 0.55;
    const deskHeight = 0.74;

    for (let r = 0; r < rows; r++) {
      const rowZ = room.y + 3.2 + r * 1.35;
      for (let c = 0; c < desksPerRow; c++) {
        const deskX = room.x + 1.8 + c * 3.8;

        // Desk top
        const deskGeom = new THREE.BoxGeometry(deskWidth, 0.04, deskDepth);
        const desk = new THREE.Mesh(deskGeom, this.oakWoodMat);
        desk.position.set(deskX, deskHeight, rowZ);
        desk.castShadow = true;
        group.add(desk);

        // Desk metal legs
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, deskHeight, deskDepth * 0.8), this.metalFrameMat);
        leg1.position.set(deskX - deskWidth / 2 + 0.08, deskHeight / 2, rowZ);
        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, deskHeight, deskDepth * 0.8), this.metalFrameMat);
        leg2.position.set(deskX + deskWidth / 2 - 0.08, deskHeight / 2, rowZ);
        group.add(leg1, leg2);

        // Student chairs behind desk
        for (let k = 0; k < 3; k++) {
          const chairX = deskX - deskWidth / 3 + k * (deskWidth / 3);
          const chair = this.createErgonomicChair(chairX, rowZ + 0.42, 0);
          group.add(chair);
        }
      }
    }

    this.parentGroup.add(group);
  }

  /**
   * AI & Robotics Lab: modular workbenches, equipment racks, test platforms.
   */
  private stageRoboticsLab(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // Two central island lab workbenches
    for (let i = 0; i < 2; i++) {
      const benchZ = room.y + 2.5 + i * 2.6;
      const benchGeom = new THREE.BoxGeometry(8.0, 0.9, 1.4);
      const bench = new THREE.Mesh(benchGeom, this.labSurfaceMat);
      bench.position.set(room.x + room.width / 2, 0.45, benchZ);
      bench.castShadow = true;
      group.add(bench);

      // Computer monitors & test equipment on benches
      for (let m = 0; m < 4; m++) {
        const monX = room.x + room.width / 2 - 3.0 + m * 2.0;
        const monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.04), this.darkPlasticMat);
        monScreen.position.set(monX, 1.15, benchZ);
        const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), this.metalFrameMat);
        monStand.position.set(monX, 0.95, benchZ);
        group.add(monScreen, monStand);
      }
    }

    // Robotics test arena in the corner
    const arenaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const arena = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 3.5), arenaMat);
    arena.position.set(room.x + room.width - 2.5, 0.04, room.y + room.height - 2.5);
    group.add(arena);

    this.parentGroup.add(group);
  }

  /**
   * Electronics Lab: perimeter technical workbenches with oscilloscope shapes.
   */
  private stageElectronicsLab(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // Technical workbench along South wall
    const benchGeom = new THREE.BoxGeometry(room.width - 2.0, 0.9, 0.85);
    const bench = new THREE.Mesh(benchGeom, this.labSurfaceMat);
    bench.position.set(room.x + room.width / 2, 0.45, room.y + room.height - 0.65);
    bench.castShadow = true;
    group.add(bench);

    // Oscilloscope & power supply test boxes on bench
    for (let b = 0; b < 4; b++) {
      const boxX = room.x + 2.0 + b * 2.4;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.4), this.metalFrameMat);
      box.position.set(boxX, 1.04, room.y + room.height - 0.65);
      group.add(box);
    }

    this.parentGroup.add(group);
  }

  /**
   * Faculty Office: executive desk, ergonomic chair, meeting chairs, tall bookcase.
   */
  private stageFacultyOffice(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // Executive L-Desk
    const deskGeom = new THREE.BoxGeometry(1.8, 0.75, 0.85);
    const desk = new THREE.Mesh(deskGeom, this.oakWoodMat);
    desk.position.set(room.x + room.width / 2, 0.375, room.y + 2.5);
    desk.castShadow = true;

    // Monitor
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.04), this.darkPlasticMat);
    monitor.position.set(room.x + room.width / 2, 0.98, room.y + 2.5);

    // Executive Chair
    const execChair = this.createErgonomicChair(room.x + room.width / 2, room.y + 1.7, 0);

    // Bookcase along East wall
    const bookCaseGeom = new THREE.BoxGeometry(0.4, 2.2, 1.8);
    const bookCase = new THREE.Mesh(bookCaseGeom, this.oakWoodMat);
    bookCase.position.set(room.x + room.width - 0.3, 1.1, room.y + room.height / 2);
    bookCase.castShadow = true;

    group.add(desk, monitor, execChair, bookCase);
    this.parentGroup.add(group);
  }

  /** Check if a door exists near coordinates to prevent furniture blocking doorways. */
  private hasDoorNear(x: number, z: number, radius: number = 1.5): boolean {
    for (const door of this.floorPlan.doors) {
      if (Math.hypot(door.x - x, door.y - z) < radius) return true;
    }
    return false;
  }

  /**
   * Seminar / Conference Room: conference table, 8-10 executive chairs, wall display.
   */
  private stageSeminarRoom(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // Large Conference Table
    const tableGeom = new THREE.BoxGeometry(3.4, 0.75, 1.5);
    const table = new THREE.Mesh(tableGeom, this.oakWoodMat);
    table.position.set(room.x + room.width / 2, 0.375, room.y + room.height / 2);
    table.castShadow = true;
    group.add(table);

    // Wall Conference Display:
    // Check if the North wall has a door opening (e.g. at room.x + room.width / 2).
    // If so, mount the display cleanly on the solid West wall facing into the room.
    const displayGroup = new THREE.Group();
    displayGroup.name = `seminar-display-${room.id}`;
    const frameGeom = new THREE.BoxGeometry(0.04, 1.25, 2.2);
    const frameMesh = new THREE.Mesh(frameGeom, this.darkPlasticMat);
    displayGroup.add(frameMesh);

    // Backlit conference presentation panel
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x142330,
      emissive: 0x1947e5,
      emissiveIntensity: 0.12,
      roughness: 0.3,
      metalness: 0.7,
    });
    const screenGeom = new THREE.BoxGeometry(0.015, 1.15, 2.1);
    const screenMesh = new THREE.Mesh(screenGeom, screenMat);
    screenMesh.position.set(0.02, 0, 0);
    displayGroup.add(screenMesh);

    const northCenterDoor = this.hasDoorNear(room.x + room.width / 2, room.y, 1.4);
    if (northCenterDoor) {
      // Mount on West interior partition wall
      displayGroup.position.set(room.x + this.floorPlan.defaultInteriorThickness / 2 + 0.03, 1.75, room.y + room.height / 2);
    } else {
      // Mount on North wall rotated
      displayGroup.position.set(room.x + room.width / 2, 1.75, room.y + this.floorPlan.defaultInteriorThickness / 2 + 0.03);
      displayGroup.rotation.y = -Math.PI / 2;
    }
    group.add(displayGroup);

    // Chairs around table
    for (let i = 0; i < 4; i++) {
      const chairX = room.x + room.width / 2 - 1.2 + i * 0.8;
      const chairNorth = this.createErgonomicChair(chairX, room.y + room.height / 2 - 1.1, Math.PI);
      const chairSouth = this.createErgonomicChair(chairX, room.y + room.height / 2 + 1.1, 0);
      group.add(chairNorth, chairSouth);
    }

    this.parentGroup.add(group);
  }

  /**
   * Main Corridor: directional wayfinding signs, emergency exit lights.
   */
  private stageCorridor(room: RoomData): void {
    const group = new THREE.Group();
    group.name = `staging-${room.id}`;

    // Emergency Exit Signs (illuminated green)
    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 256;
    exitCanvas.height = 128;
    const ectx = exitCanvas.getContext('2d')!;
    ectx.fillStyle = '#10b981';
    ectx.fillRect(0, 0, 256, 128);
    ectx.fillStyle = '#ffffff';
    ectx.font = 'bold 38px "Segoe UI", sans-serif';
    ectx.textAlign = 'center';
    ectx.textBaseline = 'middle';
    ectx.fillText('EXIT  ➔', 128, 64);

    const exitTex = new THREE.CanvasTexture(exitCanvas);
    const exitMat = new THREE.MeshStandardMaterial({
      map: exitTex,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
    });

    const exitSignGeom = new THREE.BoxGeometry(0.55, 0.25, 0.04);
    const exitSign = new THREE.Mesh(exitSignGeom, exitMat);
    exitSign.position.set(room.x + 1.5, 2.7, room.y + room.height / 2);
    group.add(exitSign);

    this.parentGroup.add(group);
  }

  // --- Residential Fallbacks for Sample House ---
  private stageResidentialLiving(room: RoomData): void {
    const group = new THREE.Group();
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.9), sofaMat);
    seat.position.set(room.x + room.width / 2, 0.21, room.y + room.height / 2);
    seat.castShadow = true;
    group.add(seat);
    this.parentGroup.add(group);
  }

  private stageResidentialBedroom(room: RoomData): void {
    const group = new THREE.Group();
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.1), this.oakWoodMat);
    bedFrame.position.set(room.x + room.width / 2, 0.15, room.y + room.height / 2);
    bedFrame.castShadow = true;
    group.add(bedFrame);
    this.parentGroup.add(group);
  }

  private stageResidentialKitchen(room: RoomData): void {
    const group = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(room.width * 0.8, 0.9, 0.7), this.labSurfaceMat);
    counter.position.set(room.x + room.width / 2, 0.45, room.y + 0.5);
    group.add(counter);
    this.parentGroup.add(group);
  }

  private createErgonomicChair(x: number, z: number, rotY: number): THREE.Group {
    const chair = new THREE.Group();
    const seatGeom = new THREE.BoxGeometry(0.46, 0.06, 0.46);
    const seat = new THREE.Mesh(seatGeom, this.fabricSeatMat);
    seat.position.set(0, 0.45, 0);

    const backGeom = new THREE.BoxGeometry(0.44, 0.45, 0.05);
    const back = new THREE.Mesh(backGeom, this.fabricSeatMat);
    back.position.set(0, 0.7, -0.21);

    const legGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
    const leg = new THREE.Mesh(legGeom, this.metalFrameMat);
    leg.position.set(0, 0.225, 0);

    chair.add(seat, back, leg);
    chair.position.set(x, 0, z);
    chair.rotation.y = rotY;
    chair.castShadow = true;
    return chair;
  }
}
