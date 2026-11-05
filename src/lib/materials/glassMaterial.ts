import * as THREE from "three";
import type { GlassPreset } from "./glassPresets";

/**
 * THE PRODUCTION API.
 *
 * The configurator calls this; the lab calls this. One code path, so a preset
 * that looks right in the lab looks identical in the product.
 */
export function applyGlassPreset(
  mesh: THREE.Mesh,
  preset: GlassPreset,
): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, // colour lives in ATTENUATION, never in base colour
    metalness: 0,
    roughness: preset.roughness,
    transmission: preset.transmission,
    ior: preset.ior,
    thickness: preset.thickness,
    attenuationColor: new THREE.Color(preset.attenuationColor),
    attenuationDistance: preset.attenuationDistance,
    dispersion: preset.dispersion,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: preset.clearcoatRoughness,
    envMapIntensity: preset.envMapIntensity,
    // thin-wall stays OPAQUE-pipeline: transmission renders the see-through;
    // transparent:true forced per-frame sorting across the hollow shell's
    // four face layers and flickered during rotation (Jordan, 2026-08-31)
    transparent: false,
    side: preset.thinWall ? THREE.DoubleSide : THREE.FrontSide,
  });
  const old = mesh.material;
  mesh.material = m;
  if (old && !Array.isArray(old)) old.dispose();
  return m;
}
