import * as THREE from 'three';
import { CollisionSystem } from './CollisionSystem';

export interface ControllerOptions {
  moveSpeed?: number;
  sprintMultiplier?: number;
  mouseSensitivity?: number;
  eyeHeight?: number;
}

export class FirstPersonController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private collisionSystem: CollisionSystem;

  public isLocked: boolean = false;
  private isEnabled: boolean = true;

  // Rotation angles in radians (Euler 'YXZ' convention)
  private yaw: number = 0;
  private pitch: number = 0;

  // Options
  private moveSpeed: number = 3.2; // m/s
  private sprintMultiplier: number = 1.6;
  private mouseSensitivity: number = 0.0022;
  private eyeHeight: number = 1.65; // standard human eye level (meters)

  // Motion physics
  private velocity: THREE.Vector3 = new THREE.Vector3();
  private direction: THREE.Vector3 = new THREE.Vector3();
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  // Subtle head-bobbing for walking immersion
  private walkDistance: number = 0;
  public enableHeadBob: boolean = true;

  // Listeners
  private onLockChangeCallback?: (isLocked: boolean) => void;
  private onPositionUpdateCallback?: (x: number, z: number, yaw: number) => void;
  private onToggleMapCallback?: () => void;
  private onToggleCeilingCallback?: () => void;
  private onResetPlayerCallback?: () => void;

  // Bound event listeners
  private _onMouseMove: (e: MouseEvent) => void;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onPointerLockChange: () => void;
  private _onPointerLockError: (e: Event) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    collisionSystem: CollisionSystem,
    options?: ControllerOptions
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.collisionSystem = collisionSystem;

    if (options?.moveSpeed) this.moveSpeed = options.moveSpeed;
    if (options?.sprintMultiplier) this.sprintMultiplier = options.sprintMultiplier;
    if (options?.mouseSensitivity) this.mouseSensitivity = options.mouseSensitivity;
    if (options?.eyeHeight) this.eyeHeight = options.eyeHeight;

    this.camera.rotation.order = 'YXZ';

    this._onMouseMove = this.onMouseMove.bind(this);
    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onPointerLockChange = this.onPointerLockChange.bind(this);
    this._onPointerLockError = this.onPointerLockError.bind(this);

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    document.addEventListener('mousemove', this._onMouseMove, false);
    document.addEventListener('keydown', this._onKeyDown, false);
    document.addEventListener('keyup', this._onKeyUp, false);
    document.addEventListener('pointerlockchange', this._onPointerLockChange, false);
    document.addEventListener('pointerlockerror', this._onPointerLockError, false);
  }

  public dispose(): void {
    document.removeEventListener('mousemove', this._onMouseMove, false);
    document.removeEventListener('keydown', this._onKeyDown, false);
    document.removeEventListener('keyup', this._onKeyUp, false);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange, false);
    document.removeEventListener('pointerlockerror', this._onPointerLockError, false);
  }

  public setOnLockChange(callback: (isLocked: boolean) => void): void {
    this.onLockChangeCallback = callback;
  }

  public setOnPositionUpdate(callback: (x: number, z: number, yaw: number) => void): void {
    this.onPositionUpdateCallback = callback;
  }

  public setOnToggleMap(callback: () => void): void {
    this.onToggleMapCallback = callback;
  }

  public setOnToggleCeiling(callback: () => void): void {
    this.onToggleCeilingCallback = callback;
  }

  public setOnResetPlayer(callback: () => void): void {
    this.onResetPlayerCallback = callback;
  }

  public requestLock(): void {
    if (!this.isLocked) {
      try {
        this.domElement.requestPointerLock();
      } catch (err) {
        console.warn('Pointer lock request failed:', err);
      }
    }
  }

  public exitLock(): void {
    if (this.isLocked && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  public setCollisionSystem(collisionSystem: CollisionSystem): void {
    this.collisionSystem = collisionSystem;
  }

  private onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (this.onLockChangeCallback) {
      this.onLockChangeCallback(this.isLocked);
    }
  }

  private onPointerLockError(event: Event): void {
    console.warn('Pointer lock error occurred', event);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isLocked || !this.isEnabled) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    this.yaw -= movementX * this.mouseSensitivity;
    this.pitch -= movementY * this.mouseSensitivity;

    // Clamp pitch between -85 and +85 degrees to avoid camera gimbal inversion
    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private onKeyDown(event: KeyboardEvent): void {
    // If typing in an input field or modal, don't capture
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
      case 'KeyM':
        if (this.onToggleMapCallback) {
          this.onToggleMapCallback();
        }
        break;
      case 'KeyC':
        if (this.onToggleCeilingCallback) {
          this.onToggleCeilingCallback();
        }
        break;
      case 'KeyR':
        if (this.onResetPlayerCallback) {
          this.onResetPlayerCallback();
        }
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
    }
  }

  public setPosition(x: number, y: number, z: number, yaw?: number): void {
    this.camera.position.set(x, y, z);
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.pitch = 0;
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }
    this.velocity.set(0, 0, 0);

    if (this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(this.camera.position.x, this.camera.position.z, this.yaw);
    }
  }

  public update(deltaSeconds: number): void {
    if (!this.isEnabled) return;

    // Constrain delta to avoid sudden spikes
    const delta = Math.min(deltaSeconds, 0.1);

    // Compute input intent vector
    this.direction.z = Number(this.keys.forward) - Number(this.keys.backward);
    this.direction.x = Number(this.keys.right) - Number(this.keys.left);
    this.direction.normalize();

    const isMoving = this.keys.forward || this.keys.backward || this.keys.left || this.keys.right;
    const speed = this.moveSpeed * (this.keys.sprint ? this.sprintMultiplier : 1.0);

    // Smooth movement damping (drag / deceleration)
    const damping = 12.0;
    this.velocity.x -= this.velocity.x * damping * delta;
    this.velocity.z -= this.velocity.z * damping * delta;

    if (isMoving) {
      // Calculate movement vector relative to camera horizontal yaw
      const sinYaw = Math.sin(this.yaw);
      const cosYaw = Math.cos(this.yaw);

      // Forward direction in XZ plane is (-sin(yaw), -cos(yaw))
      // Right direction is (cos(yaw), -sin(yaw))
      const forwardX = -sinYaw;
      const forwardZ = -cosYaw;
      const rightX = cosYaw;
      const rightZ = -sinYaw;

      const moveX = forwardX * this.direction.z + rightX * this.direction.x;
      const moveZ = forwardZ * this.direction.z + rightZ * this.direction.x;

      const accel = 60.0;
      this.velocity.x += moveX * speed * accel * delta;
      this.velocity.z += moveZ * speed * accel * delta;

      // Cap maximum speed
      const currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (currentSpeed > speed) {
        this.velocity.x = (this.velocity.x / currentSpeed) * speed;
        this.velocity.z = (this.velocity.z / currentSpeed) * speed;
      }
    }

    // Proposed new position
    const currentX = this.camera.position.x;
    const currentZ = this.camera.position.z;

    const proposedX = currentX + this.velocity.x * delta;
    const proposedZ = currentZ + this.velocity.z * delta;

    // Check & resolve collisions against walls
    const resolved = this.collisionSystem.resolvePosition(proposedX, proposedZ);

    this.camera.position.x = resolved.x;
    this.camera.position.z = resolved.z;

    // Smooth wall sliding: project velocity vector onto wall tangent
    if (resolved.collided && (resolved.normalX !== 0 || resolved.normalZ !== 0)) {
      const dot = this.velocity.x * resolved.normalX + this.velocity.z * resolved.normalZ;
      if (dot < 0) {
        this.velocity.x -= dot * resolved.normalX;
        this.velocity.z -= dot * resolved.normalZ;
      }
    }

    // Head bob calculation
    const actualMoveDist = Math.hypot(this.camera.position.x - currentX, this.camera.position.z - currentZ);
    if (actualMoveDist > 0.001) {
      this.walkDistance += actualMoveDist;
    }

    if (this.enableHeadBob) {
      const bobFreq = 10.0;
      const bobAmp = 0.035;
      const bobY = Math.sin(this.walkDistance * bobFreq) * bobAmp;
      this.camera.position.y = this.eyeHeight + bobY;
    } else {
      this.camera.position.y = this.eyeHeight;
    }

    if (this.onPositionUpdateCallback) {
      this.onPositionUpdateCallback(this.camera.position.x, this.camera.position.z, this.yaw);
    }
  }
}
