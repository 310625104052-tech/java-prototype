import * as THREE from 'three';
import { FloorPlanData } from '../types/floorplan';
import { CollisionSystem } from '../navigation/CollisionSystem';
import { FirstPersonController } from '../navigation/FirstPersonController';
import { FloorPlanRenderer } from './FloorPlanRenderer';

export class SceneManager {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public collisionSystem: CollisionSystem;
  public controller: FirstPersonController;
  public floorPlanRenderer: FloorPlanRenderer;
  public floorPlanData: FloorPlanData;

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private resizeObserver: ResizeObserver | null = null;

  // Key lights
  private sunLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;

  constructor(container: HTMLElement, floorPlanData: FloorPlanData) {
    this.container = container;
    this.floorPlanData = floorPlanData;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce7f3); // Soft sky atmosphere
    this.scene.fog = new THREE.FogExp2(0xdce7f3, 0.015);

    // 2. Camera setup
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 100);

    // Initial camera position
    const spawn = this.floorPlanData.spawnPoint;
    this.camera.position.set(spawn.x, spawn.z || 1.65, spawn.y);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Walls and lights never move, so rendering the 2048px shadow map every frame is
    // wasted GPU time. Re-render it only when the scene changes (see refreshShadows).
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);

    // 4. Collision system
    this.collisionSystem = new CollisionSystem();
    const { bounds } = this.floorPlanData;
    this.collisionSystem.setBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    // 5. Floor plan procedural building
    this.floorPlanRenderer = new FloorPlanRenderer(this.floorPlanData, this.collisionSystem);
    this.floorPlanRenderer.build();
    this.scene.add(this.floorPlanRenderer.rootGroup);

    // 6. First-person controller
    this.controller = new FirstPersonController(
      this.camera,
      this.renderer.domElement,
      this.collisionSystem
    );
    this.resetPlayerPosition();

    // 7. Lighting
    this.setupLighting();

    // 8. Clock & resize handling
    this.clock = new THREE.Clock();
    this.setupResizeHandler();
  }

  private setupLighting(): void {
    // Hemisphere light for soft ambient fill (sky vs ground reflection)
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.85);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambientLight);

    // Directional Sun Light (casting realistic soft architectural shadows)
    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    this.sunLight.position.set(20, 28, 16);
    this.sunLight.castShadow = true;

    // Shadow camera optimization
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 70;

    const d = 16;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;

    this.scene.add(this.sunLight);
  }

  private setupResizeHandler(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height);
        }
      }
    });

    this.resizeObserver.observe(this.container);
  }

  public resetPlayerPosition(): void {
    const spawn = this.floorPlanData.spawnPoint;
    this.controller.setPosition(spawn.x, spawn.z || 1.65, spawn.y, spawn.yaw || 0);
  }

  /** Ask three.js to redraw the (otherwise frozen) shadow map on the next frame. */
  private refreshShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  public loadFloorPlan(floorPlanData: FloorPlanData): void {
    this.refreshShadows();
    this.floorPlanData = floorPlanData;
    if (this.floorPlanRenderer) {
      this.scene.remove(this.floorPlanRenderer.rootGroup);
    }
    this.collisionSystem = new CollisionSystem();
    const { bounds } = this.floorPlanData;
    this.collisionSystem.setBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    this.floorPlanRenderer = new FloorPlanRenderer(this.floorPlanData, this.collisionSystem);
    this.floorPlanRenderer.build();
    this.scene.add(this.floorPlanRenderer.rootGroup);
    this.controller.setCollisionSystem(this.collisionSystem);
    this.resetPlayerPosition();
  }

  public toggleCeiling(): boolean {
    this.refreshShadows();
    const isVisible = this.floorPlanRenderer.toggleCeiling();
    // Adjust sunlight exposure when ceiling is toggled
    if (isVisible) {
      this.renderer.toneMappingExposure = 1.15;
    } else {
      this.renderer.toneMappingExposure = 1.0;
    }
    return isVisible;
  }

  public setCeilingVisible(visible: boolean): void {
    this.refreshShadows();
    this.floorPlanRenderer.setCeilingVisible(visible);
    this.renderer.toneMappingExposure = visible ? 1.15 : 1.0;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    const animate = () => {
      if (!this.isRunning) return;
      this.animationFrameId = requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      // Container not laid out (or hidden) yet: drawing now would target a
      // zero-size framebuffer and spam GL_INVALID_FRAMEBUFFER_OPERATION.
      if (this.container.clientWidth === 0 || this.container.clientHeight === 0) return;
      this.controller.update(delta);
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public dispose(): void {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.controller.dispose();
    this.renderer.dispose();
    // dispose() frees GPU resources but keeps the WebGL context alive. Browsers cap
    // live contexts (~16 in Chrome) and then block the page, which StrictMode
    // double-mounts and hot reloads hit quickly, so release it explicitly.
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
