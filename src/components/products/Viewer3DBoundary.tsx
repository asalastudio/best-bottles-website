"use client";

/**
 * Viewer3DBoundary — makes the 3D configurator a layer that can FAIL SAFELY.
 *
 * WHY THIS EXISTS
 * On 2026-08-31 a single missing GLB (BB_ANSP_ASSEMBLY_18415.glb, retired but
 * still referenced by a loader) took down every 18-415 product page: full-page
 * "Something went wrong", no photos, no description, no price, no add-to-cart.
 * One absent file cost the whole sale, because a throw inside <Canvas>
 * propagated to the route's global error boundary with nothing in between.
 *
 * The 3D viewer is an ENHANCEMENT. The storefront must not depend on it. This
 * boundary catches anything the viewer throws — missing asset, shader compile
 * failure, lost WebGL context, GPU OOM — and renders the ordinary photo
 * gallery instead. The customer loses the 3D. They do not lose the product.
 *
 * It also refuses to mount at all where WebGL is unavailable (disabled by
 * policy, blocked extension, software rendering off), because that case
 * should degrade quietly rather than throw on first frame.
 */

import { reportError } from "@/lib/observability/report";
import React from "react";

/** Cheap, cached probe — creating a GL context is not free, so do it once. */
let webglOk: boolean | null = null;
export function isWebGLAvailable(): boolean {
  if (webglOk !== null) return webglOk;
  if (typeof window === "undefined") return true;      // SSR: decide on client
  try {
    const c = document.createElement("canvas");
    webglOk = Boolean(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl")),
    );
  } catch {
    webglOk = false;
  }
  return webglOk;
}

type Props = {
  children: React.ReactNode;
  /** rendered when the viewer cannot run — normally the photo gallery */
  fallback: React.ReactNode;
  /** for diagnosing which product tripped it */
  label?: string;
};

type State = { failed: boolean };

export default class Viewer3DBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Deliberately swallow: a 3D failure is a degraded experience, not a page
    // fault. Report it so the Platform Health panel shows which products trip
    // the configurator without letting it reach the route boundary.
    reportError(error, {
      area: "viewer-3d",
      level: "warning",
      tags: { product: this.props.label ?? "unknown" },
    });
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/** Guard + boundary in one: use this rather than the class directly. */
export function Safe3D({ children, fallback, label }: Props) {
  const [ok, setOk] = React.useState<boolean | null>(null);
  React.useEffect(() => { setOk(isWebGLAvailable()); }, []);
  // null = not probed yet (SSR/first paint). Render the fallback rather than
  // nothing, so the page is never empty and there is no layout jump.
  if (ok === false || ok === null) return <>{fallback}</>;
  return (
    <Viewer3DBoundary fallback={fallback} label={label}>
      {children}
    </Viewer3DBoundary>
  );
}
