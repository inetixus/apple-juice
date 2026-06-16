/**
 * Server-side renderer for "build vision".
 *
 * The Studio plugin can't screenshot the 3D viewport, but it CAN report the
 * exact geometry of what it built (each part's center, size, orientation,
 * color). This module turns that geometry into a real shaded PNG from a chosen
 * camera direction, so a vision-capable model can literally LOOK at the build,
 * judge proportions/placement, and fix problems.
 *
 * It's a small painter's-algorithm rasterizer: each box → 8 corners → 6 faces,
 * projected orthographically, depth-sorted, filled with flat shading + a thin
 * outline. No GPU, no native deps.
 */

import { encodePngDataUri } from "@/lib/agent/png";

export type RenderPart = {
  name?: string;
  /** Center position [x,y,z] (studs). */
  position: [number, number, number];
  /** Full size [x,y,z] (studs). */
  size: [number, number, number];
  /** Orientation in degrees [x,y,z] (optional). */
  orientation?: [number, number, number];
  /** Color [r,g,b] 0-255. */
  color?: [number, number, number];
  transparency?: number;
};

export type ViewDirection =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "iso"; // isometric 3/4 view (default — most informative)

type Vec3 = [number, number, number];

const WIDTH = 512;
const HEIGHT = 512;

function rotateXYZ(p: Vec3, degX: number, degY: number, degZ: number): Vec3 {
  const rx = (degX * Math.PI) / 180;
  const ry = (degY * Math.PI) / 180;
  const rz = (degZ * Math.PI) / 180;
  let [x, y, z] = p;
  // X
  let cy = Math.cos(rx), sy = Math.sin(rx);
  [y, z] = [y * cy - z * sy, y * sy + z * cy];
  // Y
  cy = Math.cos(ry); sy = Math.sin(ry);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  // Z
  cy = Math.cos(rz); sy = Math.sin(rz);
  [x, y] = [x * cy - y * sy, x * sy + y * cy];
  return [x, y, z];
}

/** Camera basis (right, up, forward) for each view direction. */
function cameraFor(dir: ViewDirection): { right: Vec3; up: Vec3; fwd: Vec3 } {
  switch (dir) {
    case "front":
      return { right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1] };
    case "back":
      return { right: [-1, 0, 0], up: [0, 1, 0], fwd: [0, 0, 1] };
    case "left":
      return { right: [0, 0, -1], up: [0, 1, 0], fwd: [-1, 0, 0] };
    case "right":
      return { right: [0, 0, 1], up: [0, 1, 0], fwd: [1, 0, 0] };
    case "top":
      return { right: [1, 0, 0], up: [0, 0, 1], fwd: [0, -1, 0] };
    case "bottom":
      return { right: [1, 0, 0], up: [0, 0, -1], fwd: [0, 1, 0] };
    case "iso":
    default: {
      // 3/4 isometric: yaw 45°, pitch ~30°.
      const yaw = (45 * Math.PI) / 180;
      const pitch = (30 * Math.PI) / 180;
      const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
      const fwd: Vec3 = [
        Math.sin(yaw) * Math.cos(pitch),
        -Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch),
      ];
      // up = right × fwd
      const up: Vec3 = [
        right[1] * fwd[2] - right[2] * fwd[1],
        right[2] * fwd[0] - right[0] * fwd[2],
        right[0] * fwd[1] - right[1] * fwd[0],
      ];
      return { right, up, fwd };
    }
  }
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Build the 8 corners of a box given center, size, orientation. */
function boxCorners(part: RenderPart): Vec3[] {
  const [sx, sy, sz] = part.size;
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const [ox, oy, oz] = part.orientation ?? [0, 0, 0];
  const [cx, cy, cz] = part.position;
  const local: Vec3[] = [
    [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
    [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
  ];
  return local.map((p) => {
    const r = rotateXYZ(p, ox, oy, oz);
    return [r[0] + cx, r[1] + cy, r[2] + cz] as Vec3;
  });
}

const FACES = [
  [0, 1, 2, 3], // -z
  [5, 4, 7, 6], // +z
  [4, 0, 3, 7], // -x
  [1, 5, 6, 2], // +x
  [3, 2, 6, 7], // +y (top)
  [4, 5, 1, 0], // -y (bottom)
];

type ProjFace = {
  pts: { x: number; y: number }[];
  depth: number;
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * Render the parts to a PNG data URI from the given direction.
 * Returns null if there's nothing to render.
 */
export function renderBuild(
  parts: RenderPart[],
  dir: ViewDirection = "iso",
): string | null {
  const valid = parts.filter(
    (p) => p && Array.isArray(p.position) && Array.isArray(p.size),
  );
  if (valid.length === 0) return null;

  const cam = cameraFor(dir);
  const lightDir: Vec3 = (() => {
    // Light slightly above-front-right of the camera for readable shading.
    const l: Vec3 = [
      cam.fwd[0] * -0.4 + cam.right[0] * 0.5 + cam.up[0] * 0.6,
      cam.fwd[1] * -0.4 + cam.right[1] * 0.5 + cam.up[1] * 0.6,
      cam.fwd[2] * -0.4 + cam.right[2] * 0.5 + cam.up[2] * 0.6,
    ];
    const len = Math.hypot(l[0], l[1], l[2]) || 1;
    return [l[0] / len, l[1] / len, l[2] / len];
  })();

  // Project every face to camera space and collect screen coords + depth.
  const projected: ProjFace[] = [];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;

  type Raw = { u: number; v: number; d: number };
  const facesRaw: { pts: Raw[]; depth: number; part: RenderPart; faceIdx: number }[] = [];

  for (const part of valid) {
    const corners = boxCorners(part);
    const proj = corners.map((c) => ({
      u: dot(c, cam.right),
      v: dot(c, cam.up),
      d: dot(c, cam.fwd),
    }));
    for (let f = 0; f < FACES.length; f++) {
      const idx = FACES[f];
      const pts = idx.map((i) => proj[i]);
      const depth = (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4;
      facesRaw.push({ pts, depth, part, faceIdx: f });
      for (const p of pts) {
        if (p.u < minU) minU = p.u;
        if (p.u > maxU) maxU = p.u;
        if (p.v < minV) minV = p.v;
        if (p.v > maxV) maxV = p.v;
      }
    }
  }

  // Fit the bounding box into the image with a margin.
  const margin = 36;
  const spanU = maxU - minU || 1;
  const spanV = maxV - minV || 1;
  const scale = Math.min((WIDTH - margin * 2) / spanU, (HEIGHT - margin * 2) / spanV);
  const offU = (WIDTH - spanU * scale) / 2;
  const offV = (HEIGHT - spanV * scale) / 2;

  const toScreen = (u: number, v: number) => ({
    x: offU + (u - minU) * scale,
    // Flip V so +up is up on screen.
    y: HEIGHT - (offV + (v - minV) * scale),
  });

  // Face normals (camera-space) for flat shading.
  const FACE_NORMALS_LOCAL: Vec3[] = [
    [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, -1, 0],
  ];

  for (const fr of facesRaw) {
    const [r0, g0, b0] = fr.part.color ?? [150, 150, 150];
    // Shade by the world-space normal vs light.
    const o = fr.part.orientation ?? [0, 0, 0];
    const n = rotateXYZ(FACE_NORMALS_LOCAL[fr.faceIdx], o[0], o[1], o[2]);
    const nlen = Math.hypot(n[0], n[1], n[2]) || 1;
    const ndotl = (n[0] * lightDir[0] + n[1] * lightDir[1] + n[2] * lightDir[2]) / nlen;
    const shade = 0.55 + 0.45 * Math.max(0, ndotl); // 0.55–1.0
    projected.push({
      pts: fr.pts.map((p) => toScreen(p.u, p.v)),
      depth: fr.depth,
      r: Math.min(255, r0 * shade),
      g: Math.min(255, g0 * shade),
      b: Math.min(255, b0 * shade),
      a: 1 - Math.min(0.9, fr.part.transparency ?? 0),
    });
  }

  // Painter's algorithm: far faces first (smaller fwd-depth is closer to cam).
  projected.sort((a, b) => b.depth - a.depth);

  // Rasterize.
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4);
  // Background: soft studio grey.
  for (let i = 0; i < WIDTH * HEIGHT; i++) {
    rgba[i * 4] = 28;
    rgba[i * 4 + 1] = 30;
    rgba[i * 4 + 2] = 36;
    rgba[i * 4 + 3] = 255;
  }

  // Ground grid line at v≈ground for orientation (subtle).
  for (const face of projected) {
    fillPolygon(rgba, face.pts, face.r, face.g, face.b, face.a);
    strokePolygon(rgba, face.pts, 18, 19, 24);
  }

  return encodePngDataUri(rgba, WIDTH, HEIGHT);
}

function setPx(buf: Buffer, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  if (a >= 1) {
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  } else {
    const ia = 1 - a;
    buf[i] = r * a + buf[i] * ia;
    buf[i + 1] = g * a + buf[i + 1] * ia;
    buf[i + 2] = b * a + buf[i + 2] * ia;
    buf[i + 3] = 255;
  }
}

/** Scanline fill of a convex quad (4 points). */
function fillPolygon(
  buf: Buffer,
  pts: { x: number; y: number }[],
  r: number, g: number, b: number, a: number,
) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(HEIGHT - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a1 = pts[i];
      const b1 = pts[(i + 1) % pts.length];
      if ((a1.y <= y && b1.y > y) || (b1.y <= y && a1.y > y)) {
        const t = (y - a1.y) / (b1.y - a1.y);
        xs.push(a1.x + t * (b1.x - a1.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.floor(xs[k]));
      const x1 = Math.min(WIDTH - 1, Math.ceil(xs[k + 1]));
      for (let x = x0; x <= x1; x++) setPx(buf, x, y, r, g, b, a);
    }
  }
}

function strokePolygon(
  buf: Buffer,
  pts: { x: number; y: number }[],
  r: number, g: number, b: number,
) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const c = pts[(i + 1) % pts.length];
    line(buf, a.x, a.y, c.x, c.y, r, g, b);
  }
}

function line(
  buf: Buffer,
  x0: number, y0: number, x1: number, y1: number,
  r: number, g: number, b: number,
) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    setPx(buf, x0, y0, r, g, b, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
