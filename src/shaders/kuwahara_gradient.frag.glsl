#version 300 es
precision highp float;

uniform sampler2D uVideo;
uniform vec2 uTexel;   // 1 / (half-resolution target size)
uniform int uRadius;   // 3
in vec2 vUv;
out vec4 outColor;

const vec3 PURPLE = vec3(0.16470588, 0.03137255, 0.27058824); // #2A0845
const vec3 GREEN = vec3(0.22352941, 1.0, 0.07843137);         // #39FF14

// Video is uploaded top-row-first; mirror X and flip Y to GL orientation.
vec3 fetchVideo(vec2 uv) {
  return texture(uVideo, vec2(1.0 - uv.x, 1.0 - uv.y)).rgb;
}

// Mean (xyz) and variance (w) of one quadrant, (radius + 1)^2 taps.
vec4 quadrant(vec2 uv, vec2 dir) {
  vec3 sum = vec3(0.0);
  float sumSq = 0.0;
  float n = 0.0;
  for (int j = 0; j <= 3; j++) {
    if (j > uRadius) break;
    for (int i = 0; i <= 3; i++) {
      if (i > uRadius) break;
      vec3 c = fetchVideo(uv + vec2(float(i), float(j)) * dir * uTexel);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      sum += c;
      sumSq += l * l;
      n += 1.0;
    }
  }
  vec3 mean = sum / n;
  float lm = dot(mean, vec3(0.299, 0.587, 0.114));
  return vec4(mean, max(sumSq / n - lm * lm, 0.0));
}

void main() {
  vec4 q0 = quadrant(vUv, vec2(-1.0, -1.0));
  vec4 q1 = quadrant(vUv, vec2(1.0, -1.0));
  vec4 q2 = quadrant(vUv, vec2(-1.0, 1.0));
  vec4 q3 = quadrant(vUv, vec2(1.0, 1.0));

  vec4 best = q0;
  if (q1.w < best.w) best = q1;
  if (q2.w < best.w) best = q2;
  if (q3.w < best.w) best = q3;

  // Gradient map strictly after Kuwahara: 4 quantized bands.
  float l = dot(best.rgb, vec3(0.299, 0.587, 0.114));
  float band = floor(clamp(l, 0.0, 0.999) * 4.0) / 3.0;
  vec3 g = mix(PURPLE, GREEN, vUv.y); // green at top, purple at bottom
  outColor = vec4(g * mix(0.45, 1.0, band), 1.0);
}
