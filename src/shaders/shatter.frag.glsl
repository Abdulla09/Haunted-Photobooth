#version 300 es
precision highp float;

#define WEDGES 13

uniform sampler2D uNormal;
uniform sampler2D uMonster;
uniform vec2 uOrigin;          // [0,1]^2, uv space
uniform float uAspect;         // width / height
uniform float uBoundaries[WEDGES + 1];
uniform float uDir[WEDGES];
uniform float uSpeed[WEDGES];
uniform float uSpin[WEDGES];
uniform float uOrder[WEDGES];  // wedge indices, topmost first
uniform float uCrack;          // 0..1
uniform float uSeparate;       // 0..1

in vec2 vUv;
out vec4 outColor;

const float PI = 3.14159265358979;
const vec3 TOXIC = vec3(0.2235, 1.0, 0.0784);   // #39FF14
const vec3 BONE = vec3(0.9, 0.88, 0.8);

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}

float wrapAngle(float a) {
  a = mod(a + PI, 2.0 * PI);
  return a - PI;
}

vec2 rot(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

/* Crack glow for a jittered ray from the origin; q is aspect-corrected. */
vec2 crackAt(vec2 q, float ang, float lenMax, float seed) {
  vec2 r = vec2(cos(ang), sin(ang));
  float t = dot(q, r);
  float d = abs(q.x * r.y - q.y * r.x);
  if (t < 0.0 || t > lenMax) return vec2(0.0);
  // jitter perpendicular distance by noise along the ray (stable per step)
  d += (vnoise(t * 14.0 + seed * 31.0) - 0.5) * 0.012;
  d = abs(d);
  float glow = exp(-d * 55.0);
  float core = 1.0 - smoothstep(0.0015, 0.005, d);
  // taper at the tip
  float tip = 1.0 - smoothstep(lenMax - 0.08, lenMax, t);
  return vec2(glow * tip, core * tip);
}

void main() {
  vec2 aspect = vec2(uAspect, 1.0);
  float diag = length(aspect);
  float e = uSeparate * uSeparate * (3.0 - 2.0 * uSeparate);
  float fade = 1.0 - uSeparate;
  float crackLen = uCrack * diag * 1.1;

  vec2 p = (vUv - uOrigin) * aspect;

  for (int k = 0; k < WEDGES; k++) {
    int i = int(uOrder[k] + 0.5);
    float dir = uDir[i];
    // Speed shapes the easing curve; at separate = 1 the offset is exactly 1.25 * diag.
    float ease = pow(e, 1.8 - 0.8 * clamp(uSpeed[i] / 1.4, 0.0, 1.0));
    vec2 off = vec2(cos(dir), sin(dir)) * 1.25 * diag * ease;
    // Inverse transform: undo translation, then undo rotation about the origin.
    vec2 q = rot(p - off, -uSpin[i] * uSeparate);

    float halfW = 0.5 * (uBoundaries[i + 1] - uBoundaries[i]);
    float da = wrapAngle(atan(q.y, q.x) - dir);
    if (abs(da) > halfW) continue;

    vec2 uv = uOrigin + q / aspect;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;

    vec3 col = texture(uNormal, uv).rgb;

    // Cracks along both wedge edges; they fade out as the wedge separates.
    vec2 c0 = crackAt(q, uBoundaries[i], crackLen, float(i));
    vec2 c1 = crackAt(q, uBoundaries[i + 1], crackLen, float(i + 1));
    float glow = clamp(c0.x + c1.x, 0.0, 1.0) * fade;
    float core = clamp(c0.y + c1.y, 0.0, 1.0) * fade;
    col = mix(col, TOXIC, glow * 0.85);
    col = mix(col, BONE, core);
    outColor = vec4(col, 1.0);
    return;
  }

  outColor = vec4(texture(uMonster, vUv).rgb, 1.0);
}
