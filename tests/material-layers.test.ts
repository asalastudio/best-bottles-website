/**
 * The physical layers a token can now ask for actually reach the material.
 *
 * These are cheap tests of an expensive class of bug. The registry is the
 * ONLY path from a token to a rendered surface, and a field that is silently
 * dropped there looks exactly like a material that was tuned wrong -- you
 * chase the value in the studio for an hour and the value was never applied.
 * (That is not hypothetical: three material edits earlier in this project
 * never reached the render because materials.json was edited and tokens.json
 * was what the viewer read.)
 *
 * The last case is the one that matters most: a token naming none of the new
 * fields must build exactly what it built before, or every approved material
 * in the locked set moves.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createMaterial, type TokenSpec } from "@/lib/materials/registry";

const base: TokenSpec = { class: "polymer", family: "pp", baseColorHex: "#e0a8c2" };
const noEnvs = {};

describe("createMaterial — physical layers", () => {
  it("carries iridescence, which is what makes a pearl a pearl", () => {
    const m = createMaterial(
      { ...base, iridescence: 0.4, iridescenceIOR: 1.25,
        iridescenceThicknessRange: [180, 520] },
      noEnvs,
    );
    expect(m.iridescence).toBe(0.4);
    expect(m.iridescenceIOR).toBe(1.25);
    expect(m.iridescenceThicknessRange).toEqual([180, 520]);
  });

  it("carries anisotropy, the directional highlight of a spun cap", () => {
    const m = createMaterial(
      { ...base, metalness: 1, anisotropy: 0.7, anisotropyRotation: Math.PI / 2 },
      noEnvs,
    );
    expect(m.anisotropy).toBe(0.7);
    expect(m.anisotropyRotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it("carries sheen for fabric and soft-touch finishes", () => {
    const m = createMaterial(
      { ...base, sheen: 0.8, sheenRoughness: 0.35, sheenColor: "#d8c8a0" },
      noEnvs,
    );
    expect(m.sheen).toBe(0.8);
    expect(m.sheenRoughness).toBe(0.35);
    expect(m.sheenColor.getHexString()).toBe("d8c8a0");
  });

  it("carries dispersion — the fire in a rhinestone", () => {
    const m = createMaterial({ ...base, transmission: 1, dispersion: 3.2 }, noEnvs);
    expect(m.dispersion).toBe(3.2);
  });

  it("carries attenuation, which is what separates amber glass from brown plastic", () => {
    const m = createMaterial(
      { ...base, transmission: 1, thickness: 2.4,
        attenuationDistance: 12, attenuationColor: "#b06a12" },
      noEnvs,
    );
    expect(m.attenuationDistance).toBe(12);
    expect(m.attenuationColor.getHexString()).toBe("b06a12");
    expect(m.thickness).toBe(2.4);
  });

  it("leaves an existing token EXACTLY as it was", () => {
    // the shape every approved material in the locked set uses today
    const legacy: TokenSpec = {
      class: "metal", family: "alu", baseColorHex: "#c9c9c9",
      metalness: 1, roughness: 0.28, specularIntensity: 1.1,
    };
    const m = createMaterial(legacy, noEnvs);
    const fresh = new THREE.MeshPhysicalMaterial();
    for (const k of ["iridescence", "anisotropy", "sheen", "dispersion"] as const) {
      expect(m[k]).toBe(fresh[k]);
    }
    // and the fields it DID declare still land
    expect(m.metalness).toBe(1);
    expect(m.roughness).toBe(0.28);
    expect(m.specularIntensity).toBe(1.1);
  });
});
