/**
 * BottleGlassMaterial — one shader for every bottle and every glass.
 *
 * It draws a plane. Everything that makes the plane read as a bottle comes from
 * the master's thickness bake, which carries four channels:
 *
 *     R  path length through glass, in millimetres
 *     G  curvature: the sine of the surface angle across the row
 *     B  solidity: 1 where the ray misses the cavity (side walls, base puck)
 *     A  coverage
 *
 * Those are geometry, not art, and they are per MASTER — never per SKU and
 * never per colour. Colour enters only as absorption per millimetre, so a
 * single cobalt material is light through a 4.9mm wall and deep through the
 * 19.9mm base without anyone painting either.
 *
 * This is a visual approximation, not volumetric glass: there is one refraction
 * event, the background is the stage rather than the true scene, and nothing
 * behind the bottle is occluded by it. It is built to be convincing at
 * configurator cost, and the honest limits are listed in the lab.
 */

export const bottleGlassVert = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const bottleGlassFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uThickness;
uniform float uThicknessMaxMm;

uniform vec3  uAbsorption;        // per millimetre, per channel
uniform float uIor;
uniform float uRoughness;
uniform float uFrost;
uniform float uFresnelStrength;
uniform float uRefractionStrength;
uniform float uSpecularIntensity;
uniform float uEdgeIntensity;
uniform vec3  uSurfaceTint;
uniform float uThicknessInfluence;

// the studio the glass lives in
uniform vec3  uGround;
uniform float uGradient;
uniform vec3  uFoot;              // centre x, baseline y (uv), half width
uniform float uAspectWH;
uniform float uShadow;
uniform float uSpread;
uniform float uReflection;
uniform float uBaseBoost;         // strengthen the bottom glass on its own

const vec3 VIEW = vec3(0.0, 0.0, 1.0);

/** the cove: ground, falloff, the pool the bottle stands in, and its reflection */
vec3 groundAt(vec2 uv) {
    vec3 g = uGround * (1.0 - uGradient * uv.y);
    vec2 c = vec2(uFoot.x, uFoot.y);
    vec2 d1 = (uv - c) / vec2(uFoot.z * uSpread, uFoot.z * uSpread * 0.20 * uAspectWH);
    vec2 d2 = (uv - c) / vec2(uFoot.z * 1.02,    uFoot.z * 0.085 * uAspectWH);
    float pool = (1.0 - smoothstep(0.0, 1.0, length(d1))) * 0.7;
    float core = (1.0 - smoothstep(0.0, 1.0, length(d2)));
    return mix(g, g * 0.16, clamp(pool + core, 0.0, 1.0) * uShadow);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    vec4 T = texture2D(uThickness, vUv);
    float cover = T.a;

    vec3 front = groundAt(vUv);
    // the bottle standing in front of its own reflection, mirrored at the baseline
    if (vUv.y < uFoot.y) {
        vec4 m = texture2D(uThickness, vec2(vUv.x, 2.0 * uFoot.y - vUv.y));
        float fade = exp(-(uFoot.y - vUv.y) * 26.0) * uReflection;
        front = mix(front, front * 0.55, m.a * fade);
    }

    // No early return for the ground: every path must reach the colour-space
    // encode at the end. The first draw returned here, so the ground went out
    // linear while the glass went out sRGB, and clear glass read as a cream
    // solid against a tan surround — the encode, not the material.
    if (cover < 0.004) {
        gl_FragColor = vec4(front, 1.0);
        #include <colorspace_fragment>
        return;
    }

    float mm     = T.r * uThicknessMaxMm * uThicknessInfluence;
    float across = T.g * 2.0 - 1.0;                 // -1 .. +1 across the row
    float solid  = T.b;

    // curvature without a normal map: for a solid of revolution the across-row
    // position IS the sine of the surface angle, so the normal falls out of it
    float nz = sqrt(max(0.0, 1.0 - across * across));
    vec3  N  = normalize(vec3(across, 0.0, nz));

    // acid etch scatters the surface; a little noise in the normal is the
    // difference between frosted glass and a grey bottle
    if (uFrost > 0.0) {
        float n1 = hash(floor(vUv * 900.0)) - 0.5;
        float n2 = hash(floor(vUv.yx * 640.0)) - 0.5;
        N = normalize(N + vec3(n1, n2, 0.0) * 0.30 * uFrost);
    }

    float cosT = clamp(dot(N, VIEW), 0.0, 1.0);
    float f0   = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float F    = clamp(f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0), 0.0, 1.0) * uFresnelStrength;

    // --- what comes THROUGH: the stage, bent, then absorbed by the glass it crossed
    vec3  refr   = refract(-VIEW, N, 1.0 / uIor);
    float bend   = uRefractionStrength * (0.020 + 0.055 * (mm / max(uThicknessMaxMm, 0.001)));
    vec2  behind = vUv + refr.xy * bend * (1.0 - uFrost * 0.8);
    vec3  bg     = groundAt(behind);
    if (uFrost > 0.0) {
        // etched glass diffuses rather than bends: average a small neighbourhood
        vec3 blur = groundAt(behind + vec2( 0.012, 0.0)) + groundAt(behind + vec2(-0.012, 0.0))
                  + groundAt(behind + vec2(0.0,  0.014)) + groundAt(behind + vec2(0.0, -0.014));
        bg = mix(bg, blur * 0.25, uFrost * 0.85);
    }

    // --- the side walls. A ray that enters near the rim leaves the far wall
    // at a grazing angle and lands far off-axis: it returns the studio's dark
    // surround, not the lit cove behind the bottle. That, and not absorption,
    // is why clear glass has dark vertical walls on a pale ground — through
    // 12mm of soda-lime the absorption is 2%, the surround is 70% darker.
    float graze = smoothstep(0.40, 0.95, abs(across));
    float band  = smoothstep(0.30, 0.65, mm / max(uThicknessMaxMm, 0.001));
    float dark  = clamp(graze * 0.72 + band * 0.50, 0.0, 1.0)
                * (1.0 - uFrost * 0.75) * uEdgeIntensity;
    bg = mix(bg, uGround * 0.30, dark);

    // --- the base puck: solid glass across the whole row, as opposed to the
    // sidewall band, which is solid only near the rim. Its top face is a flat
    // shelf that catches the softbox; below it the ground arrives through
    // 20mm of glass and is bent hardest.
    float puck    = solid * (1.0 - smoothstep(0.55, 0.80, abs(across)));
    vec4  Tabove  = texture2D(uThickness, vUv + vec2(0.0, 0.011));
    float puckUp  = Tabove.b * (1.0 - smoothstep(0.55, 0.80, abs(Tabove.g * 2.0 - 1.0)));
    float shelf   = puck * (1.0 - puckUp);                     // the puck's top edge
    if (puck > 0.5) bg = groundAt(vUv + refr.xy * bend * 2.6 * (1.0 - uFrost * 0.8));
    bg = mix(bg, bg * 0.62, puck * 0.5 * (1.0 - uFrost * 0.5));

    // Beer-Lambert through the measured path. The base puck is the same
    // material seen through four times the glass, which is the whole point.
    float depth = mm * (1.0 + uBaseBoost * solid);
    vec3  trans = exp(-uAbsorption * depth);
    vec3  body  = bg * trans * uSurfaceTint;

    // --- softboxes. Two tall sources, so a round bottle answers with two
    // vertical highlights and nothing horizontal, the way a packshot does.
    // one key softbox off to the left, a thinner kicker on the right
    vec3 L1 = normalize(vec3(-0.50, 0.22, 0.84));
    vec3 L2 = normalize(vec3( 0.72, 0.10, 0.69));
    float shine = mix(900.0, 16.0, clamp(uRoughness + uFrost * 0.6, 0.0, 1.0));
    float s1 = pow(max(dot(N, normalize(L1 + VIEW)), 0.0), shine) * 0.9;
    float s2 = pow(max(dot(N, normalize(L2 + VIEW)), 0.0), shine * 1.6) * 0.5;
    float spec = (s1 + s2) * uSpecularIntensity * mix(1.0, 0.35, uFrost);
    spec += shelf * 0.35 * uSpecularIntensity * (1.0 - uFrost * 0.6);     // the puck's shelf

    // --- the rim. Glass gathers light where it turns away, and that bright
    // hairline is most of what says "polished" — but it is a highlight, not
    // the black outline a cut-out gives you.
    float rim  = smoothstep(0.80, 0.995, abs(across));
    float lip  = smoothstep(0.965, 1.0, abs(across));
    vec3  env  = mix(uGround * 1.28, vec3(1.0), 0.55);

    vec3 col = body;
    col = mix(col, env, F * mix(0.40, 0.25, uFrost));       // the studio, reflected
    col += env * rim * 0.10 * uEdgeIntensity;               // grazing gather
    col += vec3(1.0) * lip * 0.42 * uEdgeIntensity * (1.0 - uFrost * 0.7);   // the hairline
    col += vec3(1.0) * spec;

    gl_FragColor = vec4(mix(front, col, cover), 1.0);
    #include <colorspace_fragment>
}`;
