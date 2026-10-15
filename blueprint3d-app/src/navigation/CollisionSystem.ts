export interface WallObstacle {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  thickness: number;
}

/**
 * High-precision architectural collision detection and sliding system.
 * Uses Oriented Bounding Box (OBB) vs. Cylinder/Sphere testing with relaxation passes.
 * Accurately handles wall sides, corners, and door openings without blocking traversability.
 */
export class CollisionSystem {
  private obstacles: WallObstacle[] = [];
  public playerRadius: number = 0.22; // Comfortable human walking radius (44cm shoulder width)
  public bounds: { minX: number; minZ: number; maxX: number; maxZ: number } | null = null;

  public clear(): void {
    this.obstacles = [];
    this.bounds = null;
  }

  public setBounds(minX: number, minZ: number, maxX: number, maxZ: number): void {
    this.bounds = { minX, minZ, maxX, maxZ };
  }

  public addObstacle(x1: number, z1: number, x2: number, z2: number, thickness: number): void {
    const lenSq = (x2 - x1) ** 2 + (z2 - z1) ** 2;
    if (lenSq < 1e-6) return;
    this.obstacles.push({ x1, z1, x2, z2, thickness: Math.max(0.08, thickness) });
  }

  /**
   * Resolves collision using exact Oriented Bounding Box (OBB) distance test with wall sliding.
   * If colliding, slides along the wall surface tangent vector.
   */
  public resolvePosition(
    targetX: number,
    targetZ: number
  ): { x: number; z: number; collided: boolean; normalX: number; normalZ: number } {
    let px = targetX;
    let pz = targetZ;
    let collided = false;
    let lastNx = 0;
    let lastNz = 0;

    // Up to 4 relaxation iterations to resolve acute corners smoothly
    for (let pass = 0; pass < 4; pass++) {
      let passCollided = false;

      for (const obs of this.obstacles) {
        const segDx = obs.x2 - obs.x1;
        const segDz = obs.z2 - obs.z1;
        const length = Math.hypot(segDx, segDz);
        if (length < 1e-5) continue;

        // Unit vector along wall segment
        const ux = segDx / length;
        const uz = segDz / length;

        // Normal perpendicular to wall
        const nx = -uz;
        const nz = ux;

        // Project player into local wall space (s = along wall, d = perpendicular distance)
        const relX = px - obs.x1;
        const relZ = pz - obs.z1;

        const s = relX * ux + relZ * uz;
        const d = relX * nx + relZ * nz;

        const halfT = obs.thickness / 2;
        const R = this.playerRadius;

        // Clamped coordinates on the wall rectangular slab
        const sClamp = Math.max(0, Math.min(length, s));
        const dClamp = Math.max(-halfT, Math.min(halfT, d));

        // Closest point on the wall rectangle
        const cx = obs.x1 + sClamp * ux + dClamp * nx;
        const cz = obs.z1 + sClamp * uz + dClamp * nz;

        const diffX = px - cx;
        const diffZ = pz - cz;
        const distSq = diffX * diffX + diffZ * diffZ;

        // Check if player penetrates the wall or is closer than playerRadius to wall boundary
        const isInsideRect = s >= 0 && s <= length && Math.abs(d) <= halfT;

        if (isInsideRect) {
          // Inside wall: push out along closest side normal
          collided = true;
          passCollided = true;
          const sign = d >= 0 ? 1 : -1;
          const push = halfT + R - Math.abs(d) + 0.002;
          px += nx * sign * push;
          pz += nz * sign * push;
          lastNx = nx * sign;
          lastNz = nz * sign;
        } else if (distSq < R * R) {
          // Outside wall but intersecting corner or face within player radius
          collided = true;
          passCollided = true;
          const dist = Math.sqrt(distSq);

          if (dist > 1e-5) {
            const push = R - dist + 0.002;
            const pushNx = diffX / dist;
            const pushNz = diffZ / dist;
            px += pushNx * push;
            pz += pushNz * push;
            lastNx = pushNx;
            lastNz = pushNz;
          } else {
            // Degenerate case: push along perpendicular normal
            px += nx * (halfT + R);
            pz += nz * (halfT + R);
            lastNx = nx;
            lastNz = nz;
          }
        }
      }

      if (!passCollided) break;
    }

    // Enforce optional exterior grounds boundary if configured
    if (this.bounds) {
      const margin = 1.0;
      px = Math.max(this.bounds.minX - margin, Math.min(this.bounds.maxX + margin, px));
      pz = Math.max(this.bounds.minZ - margin, Math.min(this.bounds.maxZ + margin, pz));
    }

    return { x: px, z: pz, collided, normalX: lastNx, normalZ: lastNz };
  }
}
