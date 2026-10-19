import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FloorPlanData } from '../types/floorplan';
import { CollisionSystem } from '../navigation/CollisionSystem';
import { FirstPersonController } from '../navigation/FirstPersonController';
import { FloorPlanRenderer } from './FloorPlanRenderer';

const FRAME_INTERVAL = 1000 / 60;
const MAX_RENDER_PIXELS = 1_500_000;

export class SceneManager {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  public collisionSystem: CollisionSystem;
  public controller: FirstPersonController;
  public floorPlanRenderer: FloorPlanRenderer;
  public floorPlanData: FloorPlanData;

  private timer: THREE.Timer;
  private orbit: OrbitControls;
  private overview = false;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  private fpsFrames: number = 0;
  private fpsLastTime = 0;
  private previousFrameTime = 0;
  private renderPhase = 0;
  private resolutionScale = 1;
  private pixelRatioLimit = 1;
  private fastWindows = 0;
  public currentFps = 0;

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
    this.scene.fog = null;

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
    this.resizeRenderer(container.clientWidth || 1, container.clientHeight || 1);
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

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enabled = false;
    this.orbit.enableDamping = true;
    this.orbit.addEventListener('change', this.invalidate);
    document.addEventListener('pointerlockchange', this.invalidate);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.orbit.maxPolarAngle = Math.PI / 2 - .03;

    // 7. Lighting
    this.setupLighting();

    // 8. Timer & resize handling
    this.timer = new THREE.Timer();
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
    this.fitLightingToFloorPlan();
  }

  private setupResizeHandler(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
          this.resizeRenderer(width, height);
          this.invalidate();
        }
      }
    });

    this.resizeObserver.observe(this.container);
  }

  public resetPlayerPosition(): void {
    const spawn = this.floorPlanData.spawnPoint;
    this.controller.setPosition(spawn.x, spawn.z || 1.65, spawn.y, spawn.yaw || 0);
    this.invalidate();
  }

  /** Ask three.js to redraw the (otherwise frozen) shadow map on the next frame. */
  private refreshShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  public loadFloorPlan(floorPlanData: FloorPlanData): void {
    this.refreshShadows();
    this.floorPlanData = floorPlanData;
    if (this.floorPlanRenderer) {
      this.scene.remove(this.floorPlanRenderer.rootGroup);
      this.floorPlanRenderer.dispose();
    }
    this.collisionSystem = new CollisionSystem();
    const { bounds } = this.floorPlanData;
    this.collisionSystem.setBounds(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    this.floorPlanRenderer = new FloorPlanRenderer(this.floorPlanData, this.collisionSystem);
    this.floorPlanRenderer.build();
    this.scene.add(this.floorPlanRenderer.rootGroup);
    this.controller.setCollisionSystem(this.collisionSystem);
    this.fitLightingToFloorPlan();
    this.setOverview(true);
  }

  private fitLightingToFloorPlan(): void {
    const { bounds } = this.floorPlanData;
    const cx = (bounds.minX+bounds.maxX)/2;
    const cz = (bounds.minY+bounds.maxY)/2;
    const d = Math.max(bounds.maxX-bounds.minX, bounds.maxY-bounds.minY, 10);
    this.sunLight.position.set(cx+d, d*1.5, cz+d);
    this.sunLight.target.position.set(cx, 0, cz);
    this.scene.add(this.sunLight.target);
    Object.assign(this.sunLight.shadow.camera, {left:-d, right:d, top:d, bottom:-d, far:d*5});
    this.sunLight.shadow.camera.updateProjectionMatrix();
  }

  public setOverview(enabled: boolean): void {
    this.overview = enabled;
    this.controller.exitLock();
    this.orbit.enabled = enabled;
    this.setCeilingVisible(!enabled);
    if (enabled) {
      const b = this.floorPlanData.bounds;
      const center = new THREE.Vector3((b.minX+b.maxX)/2, .6, (b.minY+b.maxY)/2);
      const radius = Math.hypot(b.maxX-b.minX, b.maxY-b.minY, 3.2)/2;
      const fov = 2*Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*Math.min(1,this.camera.aspect));
      const distance = radius / Math.sin(fov/2) * 1.22;
      this.camera.far = Math.max(100, distance*6);
      this.camera.updateProjectionMatrix();
      this.orbit.target.copy(center);
      this.camera.position.copy(center).add(new THREE.Vector3(.5, .85, 1).normalize().multiplyScalar(distance));
      this.orbit.minDistance = radius*.5;
      this.orbit.maxDistance = distance*3;
      this.orbit.update();
    } else {
      this.resetPlayerPosition();
    }
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

  // OrbitControls emits change while damping settles. Once still, no frame is queued.
  public invalidate = (): void => {
    if (this.isRunning && !document.hidden && this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.renderFrame);
    }
  };

  private resizeRenderer(width: number, height: number): void {
    // Keep large/high-DPI displays inside a predictable GPU fill budget; HTML stays sharp.
    this.pixelRatioLimit = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_RENDER_PIXELS / (width * height)));
    this.renderer.setPixelRatio(this.pixelRatioLimit * this.resolutionScale);
    this.renderer.setSize(width, height);
  }

  private renderFrame = (timestamp = 0): void => {
    this.animationFrameId = null;
    if (!this.isRunning || document.hidden) return;
    const walking = !this.overview && this.controller.isLocked;
    if (walking && this.renderPhase && timestamp - this.renderPhase < FRAME_INTERVAL - 1.5) {
      this.invalidate();
      return;
    }
    if (walking && this.renderPhase) {
      this.renderPhase += Math.max(1, Math.floor((timestamp - this.renderPhase + 0.1) / FRAME_INTERVAL)) * FRAME_INTERVAL;
    } else this.renderPhase = timestamp;

    this.timer.update();
    const delta = this.timer.getDelta();
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) return;
    if (this.overview) this.orbit.update();
    else if (walking) this.controller.update(delta);
    this.renderer.render(this.scene, this.camera);
    this.measureFrameRate(timestamp, walking);
    if (walking) this.invalidate();
  };

  private measureFrameRate(timestamp: number, walking: boolean): void {
    let text: string | undefined;
    if (!walking || !this.previousFrameTime || timestamp - this.previousFrameTime > 250) {
      this.fpsLastTime = timestamp;
      this.fpsFrames = 0;
      this.currentFps = 0;
      text = walking ? 'Measuring…' : 'On demand';
    } else {
      this.fpsFrames++;
      const elapsed = timestamp - this.fpsLastTime;
      if (elapsed >= 750) {
        this.currentFps = Math.round(this.fpsFrames * 1000 / elapsed);
        text = `${this.currentFps} FPS`;
        const previousScale = this.resolutionScale;
        if (this.currentFps < 53) {
          this.resolutionScale = Math.max(0.55, this.resolutionScale * 0.85);
          this.fastWindows = 0;
        } else if (this.currentFps >= 59 && ++this.fastWindows >= 4) {
          this.resolutionScale = Math.min(1, this.resolutionScale + 0.05);
          this.fastWindows = 0;
        } else if (this.currentFps < 59) this.fastWindows = 0;
        if (previousScale !== this.resolutionScale) this.renderer.setPixelRatio(this.pixelRatioLimit * this.resolutionScale);
        this.fpsFrames = 0;
        this.fpsLastTime = timestamp;
      }
    }
    this.previousFrameTime = walking ? timestamp : 0;
    if (text && typeof document.getElementById === 'function') {
      for (const id of ['studio-hud-fps', 'studio-overview-fps']) {
        const element = document.getElementById(id);
        if (element && element.textContent !== text) element.textContent = text;
      }
    }
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    } else {
      this.timer.reset();
      this.renderPhase = this.previousFrameTime = 0;
      this.invalidate();
    }
  };

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.renderPhase = this.previousFrameTime = 0;
    this.timer.reset();
    this.invalidate();
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
    document.removeEventListener('pointerlockchange', this.invalidate);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.orbit.removeEventListener('change', this.invalidate);
    this.timer.dispose();
    this.controller.dispose();
    this.orbit.dispose();
    this.floorPlanRenderer.dispose();
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
