#version 300 es
precision highp float;

uniform sampler2D uVideo;
uniform vec2 uResolution;
uniform vec3 uPaper;
uniform vec3 uPurple;
uniform vec3 uOrange;
uniform vec3 uBone;
in vec2 vUv;
out vec4 outColor;

const float CELL = 10.0;
const float SIN45 = 0.70710678;
const float COS45 = 0.70710678;

float lumaAt(vec2 px) {
  // Mirrored video, flipped Y for GL orientation (same as feed.frag.glsl).
  vec2 uv = px / uResolution;
  vec3 c = texture(uVideo, vec2(1.0 - uv.x, 1.0 - uv.y)).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 p = vUv * uResolution;
  mat2 rot = mat2(COS45, -SIN45, SIN45, COS45); // rotate by +45 deg (column-major)
  mat2 inv = mat2(COS45, SIN45, -SIN45, COS45); // inverse rotation

  vec2 q = rot * p;
  vec2 cellCenterQ = (floor(q / CELL) + 0.5) * CELL;
  vec2 centerPx = inv * cellCenterQ;

  // Luminance: average of four taps around the cell center.
  float o = CELL * 0.25;
  float l = 0.25 * (lumaAt(centerPx + vec2(o, 0.0)) + lumaAt(centerPx + vec2(-o, 0.0))
                  + lumaAt(centerPx + vec2(0.0, o)) + lumaAt(centerPx + vec2(0.0, -o)));
  l = clamp(l, 0.0, 1.0);

  float radius = 0.5 * CELL * sqrt(l);
  float d = length(q - cellCenterQ);
  float dotMask = 1.0 - smoothstep(radius - 0.5, radius + 0.5, d);

  vec3 dotColor = l < 0.33 ? uPurple : (l < 0.66 ? uOrange : uBone);
  outColor = vec4(mix(uPaper, dotColor, dotMask), 1.0);
}
