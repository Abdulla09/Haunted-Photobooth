#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uPersonCenter; // normalized, top-left origin, already mirrored
uniform float uStepTime;
uniform vec3 uBone;
in vec2 vUv;
out vec4 outColor;

const float RAYS = 24.0;
const float TAU = 6.28318530718;

void main() {
  vec2 c = vec2(uPersonCenter.x, 1.0 - uPersonCenter.y);
  vec2 d = (vUv - c) * vec2(uResolution.x / uResolution.y, 1.0);
  float a = atan(d.y, d.x);
  float rayId = a * RAYS / TAU + uStepTime * 0.4;
  float ray = step(0.5, fract(rayId));
  float fade = 1.0 - smoothstep(0.0, 1.2, length(d));
  float alpha = ray * fade * 0.22;
  // Additive blend (ONE, ONE): output bone scaled by alpha.
  outColor = vec4(uBone * alpha, 0.0);
}
