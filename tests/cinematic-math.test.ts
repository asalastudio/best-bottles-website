import { describe, expect, it } from "vitest";

import {
  coverRect,
  frameIndexFromProgress,
  lerp,
} from "../public/cinematic/math.js";

describe("cinematic scroll math", () => {
  it("maps clamped scroll progress onto a zero-based frame index", () => {
    expect(frameIndexFromProgress(-1, 150)).toBe(0);
    expect(frameIndexFromProgress(0.5, 150)).toBe(75);
    expect(frameIndexFromProgress(1, 150)).toBe(149);
    expect(frameIndexFromProgress(4, 150)).toBe(149);
  });

  it("cover-fits a landscape image into a portrait viewport", () => {
    expect(coverRect(1600, 900, 900, 1200)).toEqual({
      width: 2133.333333333333,
      height: 1200,
      x: -616.6666666666665,
      y: 0,
    });
  });

  it("lerps toward a target without overshooting", () => {
    expect(lerp(0, 100, 0.12)).toBe(12);
    expect(lerp(98, 100, 0.5)).toBe(99);
  });
});
