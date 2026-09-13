"use client";
/* Exact source assemblies stay unoptimized so their alpha and glass edges are not rewritten. */
/* eslint-disable @next/next/no-img-element */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { ShaderMaterial } from 'three';
import styles from './CollectionShopping.module.css';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
varying vec2 vUv;

void main() {
  float broad = sin((vUv.x * 15.0) + (uTime * 0.42));
  float cross = sin((vUv.x * 25.0) - (vUv.y * 13.0) - (uTime * 0.31));
  float fine = sin((vUv.x * 53.0) + (vUv.y * 8.0) + (uTime * 0.19));
  float ripple = (broad * 0.48) + (cross * 0.34) + (fine * 0.18);
  float glint = smoothstep(0.54, 0.94, ripple) * (1.0 - smoothstep(0.58, 0.98, vUv.y));
  float trough = smoothstep(0.58, 0.98, -ripple) * 0.32;
  vec3 warmLight = vec3(0.78, 0.70, 0.58);
  vec3 deepWater = vec3(0.025, 0.040, 0.048);
  vec3 color = mix(deepWater, warmLight, glint);
  float alpha = (glint * 0.18) + (trough * 0.08);
  gl_FragColor = vec4(color, alpha);
}
`;

function WaterLight() {
  const material = useRef<ShaderMaterial>(null);
  const { viewport } = useThree();

  useFrame((_, delta) => {
    if (material.current) material.current.uniforms.uTime.value += delta;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{ uTime: { value: 0 } }}
      />
    </mesh>
  );
}

export function ImmersiveHeroArt() {
  return (
    <div className={styles.immersiveArt} aria-hidden="true">
      <div className={styles.heroEnvironment} />
      <div className={styles.waterCanvas}>
        <Canvas
          orthographic
          camera={{ position: [0, 0, 1], zoom: 1 }}
          dpr={[1, 1.5]}
          frameloop="always"
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        >
          <WaterLight />
        </Canvas>
      </div>
      <div className={styles.heroReflectionStage}>
        <img
          className={`${styles.exactProduct} ${styles.productGold} ${styles.productReflection}`}
          src="/assets/homepage/empire-50-gold-spray-dark.png"
          alt=""
        />
        <img
          className={`${styles.exactProduct} ${styles.productBulb} ${styles.productReflection}`}
          src="/assets/homepage/empire-50-black-bulb-dark.png"
          alt=""
        />
      </div>
      <div className={styles.heroProductStage}>
        <img
          className={`${styles.exactProduct} ${styles.productGold}`}
          src="/assets/homepage/empire-50-gold-spray-dark.png"
          alt=""
        />
        <img
          className={`${styles.exactProduct} ${styles.productBulb}`}
          src="/assets/homepage/empire-50-black-bulb-dark.png"
          alt=""
        />
      </div>
    </div>
  );
}
