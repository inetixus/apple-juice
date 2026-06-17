import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sparkles, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { IdeMockup } from './IdeMockup';

const Particles = () => {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.z += delta * 15;
      if (groupRef.current.position.z > 50) {
        groupRef.current.position.z = -50;
      }
      groupRef.current.rotation.z += delta * 0.1;
    }
  });

  const shapes = useMemo(() => {
    return Array.from({ length: 100 }).map(() => ({
      position: [
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 100 - 50
      ],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      scale: Math.random() * 0.5 + 0.1,
      color: new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.8, 0.5) // Greenish (like #a3ff12)
    }));
  }, []);

  return (
    <group ref={groupRef}>
      {shapes.map((shape, i) => (
        <Float key={i} speed={2} rotationIntensity={2} floatIntensity={2}>
          <mesh position={shape.position} rotation={shape.rotation} scale={shape.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={shape.color} wireframe={i % 2 === 0} transparent opacity={0.6} />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

export const Scene = () => {
  return (
    <>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 10, 80]} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#a3ff12" />
      <pointLight position={[-10, -10, -10]} intensity={5} color="#00f3ff" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={2} />
      <Sparkles count={500} scale={30} size={5} speed={0.4} color="#a3ff12" opacity={0.3} />

      <Particles />

      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        <Html transform position={[0, 0, -5]} scale={0.005}>
          <IdeMockup />
        </Html>
      </Float>
    </>
  );
};
