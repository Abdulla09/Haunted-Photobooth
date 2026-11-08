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

// One flame layer: returns hard-edged coverage (0 or 1).
float layer(vec2 uv, float aspect, float scale, float speed, float phase,
            float rise, float wobble, float threshold) {
  vec2 np = uv * scale * vec2(aspect, 1.0) * vec2(1.0, 0.6)
          + vec2(0.0, -uStepTime * speed) + phase;
  float n = valueNoise(np);
  // Sample the mask below the pixel so flames lick upward from the silhouette.
  vec2 s = uv + vec2((n - 0.5) * wobble, -rise * (0.5 + n));
  return step(threshold, maskAt(s));
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // Back to front: outer green (largest), middle purple, inner bone (smallest).
  float aG = layer(vUv, aspect, 6.0, 1.6, 0.0, 0.16, 0.06, 0.12);
  float aP = layer(vUv, aspect, 9.0, 2.0, 17.3, 0.11, 0.045, 0.18);
  float aB = layer(vUv, aspect, 13.0, 2.4, 41.7, 0.06, 0.03, 0.26);

  // Premultiplied "over" accumulation.
  vec4 acc = vec4(uGreen * aG, aG);
  acc = vec4(uPurple * aP, aP) + acc * (1.0 - aP);
  acc = vec4(uBone * aB, aB) + acc * (1.0 - aB);
  outColor = acc;
}
