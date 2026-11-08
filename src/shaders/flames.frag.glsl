#version 300 es
precision highp float;

uniform sampler2D uMaskBlur; // blurred person mask, unmirrored, top-row-first
uniform vec2 uResolution;
uniform float uStepTime;     // quantized to the 18 fps step
uniform vec3 uGreen;
uniform vec3 uPurple;
uniform vec3 uBone;
in vec2 vUv;
out vec4 outColor;

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

// Mask is inferred on the unmirrored frame: mirror X, flip Y.
float maskAt(vec2 uv) {
  return texture(uMaskBlur, vec2(1.0 - uv.x, 1.0 - uv.y)).r;
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

// One flame layer: hard-edged coverage (0 or 1) with jagged upward tongues.
float layer(vec2 uv, float aspect, float freq, float speed, float phase,
            float rise, float sway, float threshold, float sharp) {
  float t = uStepTime;
  vec2 p = vec2(uv.x * aspect * freq, uv.y * freq * 0.5);
  // Domain warp: rising, flickering offsets (stepped via uStepTime only).
  vec2 w = vec2(fbm(p + vec2(phase, -t * speed * 0.6)),
                fbm(p + vec2(phase + 7.7, -t * speed * 0.9)));
  vec2 q = p + (w - 0.47) * 2.6 + vec2(0.0, -t * speed);
  float n = fbm(q);
  // Ridged noise gives pointed peaks; sharpen so tongues are spiky.
  float tip = 1.0 - abs(2.0 * n - 1.0);
  tip = pow(clamp(tip, 0.0, 1.0), sharp);
  // Fast per-step flicker on tongue height.
  float flick = 0.75 + 0.25 * hash(vec2(floor(uv.x * aspect * freq), t * 3.0 + phase));
  float h = tip * flick;
  vec2 s = uv + vec2((w.x - 0.47) * sway, -rise * h);
  return step(threshold, maskAt(s));
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // Back to front: outer green (tallest), middle purple, inner bone (shortest).
  float aG = layer(vUv, aspect, 7.0, 2.2, 0.0, 0.22, 0.05, 0.20, 1.6);
  float aP = layer(vUv, aspect, 9.0, 2.6, 17.3, 0.14, 0.035, 0.24, 1.6);
  float aB = layer(vUv, aspect, 15.0, 3.4, 41.7, 0.06, 0.03, 0.42, 3.0);

  // Premultiplied "over" accumulation.
  vec4 acc = vec4(uGreen * aG, aG);
  acc = vec4(uPurple * aP, aP) + acc * (1.0 - aP);
  acc = vec4(uBone * aB, aB) + acc * (1.0 - aB);
  outColor = acc;
}