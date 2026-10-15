import * as THREE from 'three';
import { WindowData } from '../types/floorplan';

export class WindowGenerator {
  private frameMaterial: THREE.MeshStandardMaterial;
  private glassMaterial: THREE.MeshPhysicalMaterial;
  private sillMaterial: THREE.MeshStandardMaterial;

  constructor() {
    // Dark architectural aluminum window frame
    this.frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x24282e,
      roughness: 0.35,
      metalness: 0.8,
    });

    // Realistic transparent glass pane
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xbfdbfe,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.5,
      reflectivity: 0.9,
    });

    // Clean white interior sill
    this.sillMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.1,
    });
  }

  public generateWindow(windowData: WindowData): THREE.Group {
    const windowGroup = new THREE.Group();
    windowGroup.name = `window-${windowData.id}`;

    const width = windowData.width || 1.4;
    const height = windowData.height || 1.2;
    const sillHeight = windowData.sillHeight || 0.9;
    const frameDepth = 0.22;
    const frameBorder = 0.06;
    const mullionWidth = 0.035;

    const isVertical = windowData.orientation === 'vertical';

    // 1. Outer Frame (Top, Bottom, Left, Right)
    // Left border
    const leftFrameGeom = new THREE.BoxGeometry(frameBorder, height, frameDepth);
    const leftFrame = new THREE.Mesh(leftFrameGeom, this.frameMaterial);
    leftFrame.position.set(-width / 2 + frameBorder / 2, height / 2, 0);
    leftFrame.castShadow = true;
    windowGroup.add(leftFrame);

    // Right border
    const rightFrameGeom = new THREE.BoxGeometry(frameBorder, height, frameDepth);
    const rightFrame = new THREE.Mesh(rightFrameGeom, this.frameMaterial);
    rightFrame.position.set(width / 2 - frameBorder / 2, height / 2, 0);
    rightFrame.castShadow = true;
    windowGroup.add(rightFrame);

    // Top border
    const topFrameGeom = new THREE.BoxGeometry(width, frameBorder, frameDepth);
    const topFrame = new THREE.Mesh(topFrameGeom, this.frameMaterial);
    topFrame.position.set(0, height - frameBorder / 2, 0);
    topFrame.castShadow = true;
    windowGroup.add(topFrame);

    // Bottom border
    const bottomFrameGeom = new THREE.BoxGeometry(width, frameBorder, frameDepth);
    const bottomFrame = new THREE.Mesh(bottomFrameGeom, this.frameMaterial);
    bottomFrame.position.set(0, frameBorder / 2, 0);
    bottomFrame.castShadow = true;
    windowGroup.add(bottomFrame);

    // 2. Interior Window Sill Ledge (protruding slightly into the room)
    const sillDepth = frameDepth + 0.1;
    const sillThickness = 0.035;
    const sillGeom = new THREE.BoxGeometry(width + 0.1, sillThickness, sillDepth);
    const sillMesh = new THREE.Mesh(sillGeom, this.sillMaterial);
    sillMesh.position.set(0, -sillThickness / 2, 0);
    sillMesh.castShadow = true;
    sillMesh.receiveShadow = true;
    windowGroup.add(sillMesh);

    // 3. Central Vertical Mullion / Divider
    const centerMullionGeom = new THREE.BoxGeometry(mullionWidth, height - frameBorder * 2, frameDepth * 0.7);
    const centerMullion = new THREE.Mesh(centerMullionGeom, this.frameMaterial);
    centerMullion.position.set(0, height / 2, 0);
    windowGroup.add(centerMullion);

    // 4. Glass Panes (Left & Right panes)
    const glassWidth = (width - frameBorder * 2 - mullionWidth) / 2;
    const glassHeight = height - frameBorder * 2;
    const glassThickness = 0.012;

    const glassGeom = new THREE.BoxGeometry(glassWidth, glassHeight, glassThickness);

    const leftGlass = new THREE.Mesh(glassGeom, this.glassMaterial);
    leftGlass.position.set(-glassWidth / 2 - mullionWidth / 2, height / 2, 0);
    windowGroup.add(leftGlass);

    const rightGlass = new THREE.Mesh(glassGeom, this.glassMaterial);
    rightGlass.position.set(glassWidth / 2 + mullionWidth / 2, height / 2, 0);
    windowGroup.add(rightGlass);

    // Position and orientation in world
    windowGroup.position.set(windowData.x, sillHeight, windowData.y);
    if (isVertical) {
      windowGroup.rotation.y = Math.PI / 2;
    }

    return windowGroup;
  }
}
