"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import {
  backgroundFragment,
  backgroundVertex,
  blurFragment,
  blurVertex,
  fieldFragment,
  fieldVertex,
  glassFragment,
  glassVertex,
} from "./shaders";
import {
  createParticle,
  particleVelocityMagnitude,
  stepParticles,
  type Particle,
} from "./physics";

const MAX_PARTICLES = 24;

export type ParticleTarget = {
  x: number;
  y: number;
  radius: number;
  strength?: number;
  isUser?: boolean;
};

function makeFullscreenMaterial(
  vertex: string,
  fragment: string,
  uniforms: Record<string, THREE.IUniform>
) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

function LiquidGlassSimulation({
  targets,
  enabled,
}: {
  targets: ParticleTarget[];
  enabled: boolean;
}) {
  const { gl, size } = useThree();
  const w = Math.max(2, Math.floor(size.width));
  const h = Math.max(2, Math.floor(size.height));

  // Render internal buffers at 50% resolution to save 75% pixel rendering/memory bandwidth.
  // The blurry nature of metaballs and bilinear scaling makes this virtually indistinguishable from 100%.
  const scaleFactor = 0.5;
  const fboW = Math.max(2, Math.floor(w * scaleFactor));
  const fboH = Math.max(2, Math.floor(h * scaleFactor));

  const particlesRef = useRef<Particle[]>([]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const fboOpts = useMemo(
    () => ({
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    }),
    []
  );

  const fieldFboA = useFBO(fboW, fboH, fboOpts);
  const fieldFboB = useFBO(fboW, fboH, fboOpts);
  const bgFbo = useFBO(fboW, fboH, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const particleData = useMemo(() => new Float32Array(MAX_PARTICLES * 4), []);

  const particleTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      particleData,
      MAX_PARTICLES,
      1,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    tex.needsUpdate = true;
    return tex;
  }, [particleData]);

  const quadGeo = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const orthoCamera = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cam.position.z = 1;
    return cam;
  }, []);

  const quadMesh = useMemo(() => new THREE.Mesh(quadGeo), [quadGeo]);

  const bgMat = useMemo(
    () =>
      makeFullscreenMaterial(backgroundVertex, backgroundFragment, {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(fboW, fboH) },
      }),
    [fboW, fboH]
  );

  const fieldMat = useMemo(
    () =>
      makeFullscreenMaterial(fieldVertex, fieldFragment, {
        uParticleData: { value: particleTexture },
        uParticleCount: { value: 0 },
        uResolution: { value: new THREE.Vector2(fboW, fboH) },
      }),
    [particleTexture, fboW, fboH]
  );

  const blurMat = useMemo(
    () =>
      makeFullscreenMaterial(blurVertex, blurFragment, {
        uTexture: { value: null as THREE.Texture | null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uResolution: { value: new THREE.Vector2(fboW, fboH) },
      }),
    [fboW, fboH]
  );

  const glassMat = useMemo(
    () =>
      makeFullscreenMaterial(glassVertex, glassFragment, {
        uField: { value: null as THREE.Texture | null },
        uBackground: { value: null as THREE.Texture | null },
        uParticleData: { value: particleTexture },
        uParticleCount: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uTime: { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.35, 0.65, 0.85).normalize() },
      }),
    [particleTexture, w, h]
  );

  useEffect(() => {
    fieldMat.uniforms.uResolution.value.set(fboW, fboH);
    blurMat.uniforms.uResolution.value.set(fboW, fboH);
    glassMat.uniforms.uResolution.value.set(w, h);
    bgMat.uniforms.uResolution.value.set(fboW, fboH);
    fieldFboA.setSize(fboW, fboH);
    fieldFboB.setSize(fboW, fboH);
    bgFbo.setSize(fboW, fboH);
  }, [w, h, fboW, fboH, fieldMat, blurMat, glassMat, bgMat, fieldFboA, fieldFboB, bgFbo]);

  const syncTargetsToParticles = () => {
    const t = targetsRef.current;
    const next: Particle[] = [];

    for (let i = 0; i < t.length && i < MAX_PARTICLES; i++) {
      const tr = t[i];
      const glY = h - tr.y;
      const prev = particlesRef.current[i];

      if (prev) {
        prev.anchorX = tr.x;
        prev.anchorY = glY;
        prev.anchorStrength = tr.strength ?? 1;
        const targetR = tr.isUser ? Math.max(tr.radius, 14) : tr.radius;
        prev.radius = targetR;
        prev.mass = tr.isUser ? 1.6 : 1;
        next.push(prev);
      } else {
        next.push(
          createParticle({
            x: tr.x,
            y: glY,
            radius: tr.isUser ? Math.max(tr.radius, 14) : tr.radius,
            mass: tr.isUser ? 1.6 : 1,
            anchorX: tr.x,
            anchorY: glY,
            anchorStrength: tr.strength ?? 1,
          })
        );
      }
    }

    particlesRef.current = next;
    return next;
  };

  const uploadParticleTexture = (particles: Particle[]) => {
    const count = particles.length;
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const i4 = i * 4;
      particleData[i4] = p.x / w;
      particleData[i4 + 1] = 1 - p.y / h;
      particleData[i4 + 2] = (p.radius * 2.8) / Math.max(w, h);
      particleData[i4 + 3] = Math.min(particleVelocityMagnitude(p) / 80, 1);
    }
    for (let i = count; i < MAX_PARTICLES; i++) {
      const i4 = i * 4;
      particleData[i4] = 0;
      particleData[i4 + 1] = 0;
      particleData[i4 + 2] = 0;
      particleData[i4 + 3] = 0;
    }
    particleTexture.needsUpdate = true;
    return count;
  };

  const renderPass = (
    material: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget | null
  ) => {
    quadMesh.material = material as THREE.Material;
    gl.setRenderTarget(target);
    gl.render(quadMesh, orthoCamera);
  };

  useFrame((state) => {
    if (!enabled || targetsRef.current.length === 0) return;

    const dt = Math.min(state.clock.getDelta(), 0.032);
    const particles = syncTargetsToParticles();

    if (particles.length === 0) return;

    stepParticles(particles, dt, w, h);
    const count = uploadParticleTexture(particles);

    bgMat.uniforms.uTime.value = state.clock.elapsedTime;
    fieldMat.uniforms.uParticleCount.value = count;
    glassMat.uniforms.uParticleCount.value = count;
    glassMat.uniforms.uTime.value = state.clock.elapsedTime;

    renderPass(bgMat, bgFbo);

    gl.setClearColor(0, 0);
    gl.setRenderTarget(fieldFboA);
    gl.clear();
    renderPass(fieldMat, fieldFboA);

    blurMat.uniforms.uTexture.value = fieldFboA.texture;
    blurMat.uniforms.uDirection.value.set(1, 0);
    renderPass(blurMat, fieldFboB);

    blurMat.uniforms.uTexture.value = fieldFboB.texture;
    blurMat.uniforms.uDirection.value.set(0, 1);
    renderPass(blurMat, fieldFboA);

    glassMat.uniforms.uField.value = fieldFboA.texture;
    glassMat.uniforms.uBackground.value = bgFbo.texture;

    gl.setRenderTarget(null);
    gl.setClearColor(0, 0);
    gl.clear();
    renderPass(glassMat, null);
  }, 100);

  return null;
}

export function LiquidGlassScene({
  targets,
  enabled = true,
}: {
  targets: ParticleTarget[];
  enabled?: boolean;
}) {
  return <LiquidGlassSimulation targets={targets} enabled={enabled} />;
}
