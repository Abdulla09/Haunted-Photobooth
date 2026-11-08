#version 300 es
precision highp float;

uniform sampler2D uMaskBlur; // blurred person mask, unmirrored, top-row-first
uniform vec2 uResolution;
uniform float uStepTime;     // quantized to the 18 fps step
uniform vec3 uMint;          // ghost mint #8CFFC1 (edges)
uniform vec3 uMintShadow;    // mint shadow #2E8C6A (inside)
in vec2 vUv;
out vec4 outColor;

const float MAX_ALPHA = 0.8;
const float REACH = 0.45;    // max upward reach, fraction of frame height
const int TAPS = 8;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = p * 2.03 + vec2(5.2, 1.7);
    a *= 0.5;
  }
  return v; // ~0..0.94
}

// Mask is inferred on the unmirrored frame: mirror X, flip Y.
float maskAt(vec2 uv) {
  return texture(uMaskBlur, vec2(1.0 - uv.x, 1.0 - uv.y)).r;
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  float t = uStepTime;

  // Wispy domain-warped noise; scrolls upward over stepped time only.
  vec2 p = vec2(vUv.x * aspect * 3.2, vUv.y * 2.2 - t * 0.9);
  vec2 w = vec2(fbm(p + vec2(0.0, t * 0.2)), fbm(p + vec2(7.7, -t * 0.35)));
  float n = fbm(p + (w - 0.47) * 2.2);

  // Column weight: tall over the body core, little rise at the sides.
  float core = 0.5 * (maskAt(vUv + vec2(0.18 / aspect, -0.25)) +
                      maskAt(vUv + vec2(-0.18 / aspect, -0.25)));
  float reach = REACH * (0.35 + 0.65 * core) * (0.6 + 0.8 * n);

  // Curl: x-offset grows with height above the sampled silhouette.
  // Accumulate soft coverage from taps below (flames lick upward).
  float cover = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float f = float(i) / float(TAPS - 1);
    float d = f * reach;
    float curl = sin(vUv.y * 14.0 - t * 4.0 + n * 6.0) * 0.035 * f
               + (w.x - 0.47) * 0.08 * f;
    float m = maskAt(vUv + vec2(curl, -d));
    float fall = 1.0 - f;
    cover = max(cover, m * fall * fall);
  }

  // Tongue tips: noise erodes the fringe so edges break into curling wisps.
  float tongues = smoothstep(0.25, 0.75, n + 0.25 * (w.y - 0.47));
  float density = cover * mix(0.55, 1.15, tongues);

  // Soft edge plus a wider glow falloff (no hard step).
  float body = smoothstep(0.08, 0.55, density);
  float glow = smoothstep(0.0, 0.3, density) * 0.35;
  float a = clamp(max(body, glow), 0.0, 1.0) * MAX_ALPHA;

  // Mint shadow inside, ghost mint toward the edges.
  vec3 col = mix(uMint, uMintShadow, smoothstep(0.35, 0.95, density));
  col = mix(col, uMint, 0.25 * (1.0 - body)); // brighter glow rim

  outColor = vec4(col * a, a); // premultiplied
}
