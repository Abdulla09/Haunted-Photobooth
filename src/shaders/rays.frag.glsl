#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uPersonCenter; // normalized, top-left origin, already mirrored
uniform float uStepTime;
uniform vec3 uGreen;
uniform vec3 uOrange;
in vec2 vUv;
out vec4 outColor;

const float RAYS = 16.0;
const float TAU = 6.28318530718;

void main() {
  vec2 c = vec2(uPersonCenter.x, 1.0 - uPersonCenter.y);
  vec2 d = (vUv - c) * vec2(uResolution.x / uResolution.y, 1.0);
  float a = atan(d.y, d.x);
  float rayId = a * RAYS / TAU + uStepTime * 0.4;
  float ray = step(0.45, fract(rayId));
  // Single pumpkin-orange ray color alternating with dark gaps.
  vec3 col = uOrange;
  float fade = 1.0 - smoothstep(0.1, 1.5, length(d));
  float alpha = ray * mix(0.18, 0.45, fade);
  // Additive blend (ONE, ONE): color scaled by alpha.
  outColor = vec4(col * alpha, 0.0);
}
