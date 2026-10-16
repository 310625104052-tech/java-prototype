import * as THREE from 'three';
import { DoorData } from '../types/floorplan';

export class DoorGenerator {
  private frameMaterial: THREE.MeshStandardMaterial;
  private doorPanelMaterial: THREE.MeshStandardMaterial;
  private handleMaterial: THREE.MeshStandardMaterial;

  constructor() {
    // Elegant warm oak / mahogany architectural door material
    this.doorPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a5229,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Clean white architectural door trim & frame
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8f8f6,
      roughness: 0.4,
      metalness: 0.1,
    });

    // Brushed metal door handle
    this.handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c5ce,
      roughness: 0.25,
      metalness: 0.85,
    });
  }

  public generateDoor(door: DoorData): THREE.Group {
    const doorGroup = new THREE.Group();
    doorGroup.name = `door-${door.id}`;

    const width = door.width || 0.9;
    const height = door.height || 2.1;
    const frameThickness = 0.18; // Depth through wall
    const jambWidth = 0.05;     // Frame border width
    const panelThickness = 0.045;

    const isVertical = door.orientation === 'vertical';

    // 1. Door Frame Jamb (Left, Right, Top)
    const leftJambGeom = new THREE.BoxGeometry(jambWidth, height, frameThickness);
    const leftJamb = new THREE.Mesh(leftJambGeom, this.frameMaterial);
    leftJamb.position.set(-width / 2 + jambWidth / 2, height / 2, 0);
    leftJamb.castShadow = true;
    leftJamb.receiveShadow = true;
    doorGroup.add(leftJamb);

    const rightJambGeom = new THREE.BoxGeometry(jambWidth, height, frameThickness);
    const rightJamb = new THREE.Mesh(rightJambGeom, this.frameMaterial);
    rightJamb.position.set(width / 2 - jambWidth / 2, height / 2, 0);
    rightJamb.castShadow = true;
    rightJamb.receiveShadow = true;
    doorGroup.add(rightJamb);

    const topJambGeom = new THREE.BoxGeometry(width, jambWidth, frameThickness);
    const topJamb = new THREE.Mesh(topJambGeom, this.frameMaterial);
    topJamb.position.set(0, height - jambWidth / 2, 0);
    topJamb.castShadow = true;
    topJamb.receiveShadow = true;
    doorGroup.add(topJamb);

    // 2. Door Panel (positioned slightly open at ~25 degrees so the opening is inviting)
    const panelWidth = width - jambWidth * 2;
    const panelHeight = height - jambWidth;

    const panelPivot = new THREE.Group();
    // Pivot located at the left jamb edge
    panelPivot.position.set(-width / 2 + jambWidth, 0, 0);

    const panelGeom = new THREE.BoxGeometry(panelWidth, panelHeight, panelThickness);
    const panelMesh = new THREE.Mesh(panelGeom, this.doorPanelMaterial);
    // Center panel relative to its hinge pivot
    panelMesh.position.set(panelWidth / 2, panelHeight / 2, 0);
    panelMesh.castShadow = true;
    panelMesh.receiveShadow = true;
    panelPivot.add(panelMesh);

    // 3. Realistic Door Handle & Lock Plate
    const handleGroup = new THREE.Group();
    handleGroup.position.set(panelWidth - 0.08, 0.95, 0);

    const latchPlateGeom = new THREE.BoxGeometry(0.04, 0.12, panelThickness + 0.015);
    const latchPlate = new THREE.Mesh(latchPlateGeom, this.handleMaterial);
    handleGroup.add(latchPlate);

    // Lever handle on both sides
    const leverStemGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.07, 8);
    const leverBarGeom = new THREE.BoxGeometry(0.11, 0.02, 0.018);

    // Front handle
    const stemFront = new THREE.Mesh(leverStemGeom, this.handleMaterial);
    stemFront.rotation.x = Math.PI / 2;
    stemFront.position.set(0, 0, panelThickness / 2 + 0.035);
    const barFront = new THREE.Mesh(leverBarGeom, this.handleMaterial);
    barFront.position.set(-0.04, 0, panelThickness / 2 + 0.07);
    handleGroup.add(stemFront, barFront);

    // Back handle
    const stemBack = new THREE.Mesh(leverStemGeom, this.handleMaterial);
    stemBack.rotation.x = Math.PI / 2;
    stemBack.position.set(0, 0, -(panelThickness / 2 + 0.035));
    const barBack = new THREE.Mesh(leverBarGeom, this.handleMaterial);
    barBack.position.set(-0.04, 0, -(panelThickness / 2 + 0.07));
    handleGroup.add(stemBack, barBack);

    panelPivot.add(handleGroup);

    // Keep door comfortably open ~28 degrees
    panelPivot.rotation.y = THREE.MathUtils.degToRad(28);

    doorGroup.add(panelPivot);

    // Position and orientation in world
    doorGroup.position.set(door.x, 0, door.y);
    if (door.angle !== undefined) doorGroup.rotation.y = -door.angle;
    else if (isVertical) doorGroup.rotation.y = Math.PI / 2;

    return doorGroup;
  }
}
