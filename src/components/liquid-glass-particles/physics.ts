export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  anchorX: number | null;
  anchorY: number | null;
  anchorStrength: number;
};

export function createParticle(
  partial: Partial<Particle> & Pick<Particle, "x" | "y" | "radius">
): Particle {
  return {
    vx: 0,
    vy: 0,
    mass: 1,
    anchorX: null,
    anchorY: null,
    anchorStrength: 0,
    ...partial,
  };
}

/** Spring-damped integration with pairwise collision response */
export function stepParticles(
  particles: Particle[],
  dt: number,
  width: number,
  height: number
) {
  const substeps = 3;
  const h = dt / substeps;

  for (let s = 0; s < substeps; s++) {
    for (const p of particles) {
      let ax = 0;
      let ay = 0;

      if (p.anchorX != null && p.anchorY != null && p.anchorStrength > 0) {
        const k = 22 * p.anchorStrength;
        const damp = 6.5;
        ax += (p.anchorX - p.x) * k - p.vx * damp;
        ay += (p.anchorY - p.y) * k - p.vy * damp;
      }

      for (const q of particles) {
        if (p === q) continue;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = p.radius + q.radius * 0.92;

        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const repulse = overlap * 18;
          ax -= nx * repulse;
          ay -= ny * repulse;

          if (dist < minDist * 0.75) {
            const mergePull = overlap * 3.5;
            ax += nx * mergePull;
            ay += ny * mergePull;
          }
        }
      }

      const invMass = 1 / p.mass;
      p.vx += ax * h * invMass;
      p.vy += ay * h * invMass;

      const drag = 0.96;
      p.vx *= drag;
      p.vy *= drag;

      p.x += p.vx * h;
      p.y += p.vy * h;

      const pad = p.radius + 4;
      if (p.x < pad) {
        p.x = pad;
        p.vx *= -0.35;
      }
      if (p.x > width - pad) {
        p.x = width - pad;
        p.vx *= -0.35;
      }
      if (p.y < pad) {
        p.y = pad;
        p.vy *= -0.35;
      }
      if (p.y > height - pad) {
        p.y = height - pad;
        p.vy *= -0.35;
      }
    }
  }
}

export function particleVelocityMagnitude(p: Particle) {
  return Math.hypot(p.vx, p.vy);
}
