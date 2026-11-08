#version 300 es
precision highp float;

uniform sampler2D uStyled;   // Kuwahara + gradient intermediate (GL orientation)
uniform sampler2D uMask;     // R8 person mask, unmirrored, top-row-first
uniform vec2 uTexel;         // 1 / output size
uniform int uHasSegmenter;
in vec2 vUv;
out vec4 outColor;

const vec3 RIM = vec3(1.0, 0.41568628, 0.0); // #FF6A00

// Mask is inferred on the unmirrored frame: mirror X, flip Y.
float maskAt(vec2 uv) {
  float m = texture(uMask, vec2(1.0 - uv.x, 1.0 - uv.y)).r;
  return smoothstep(0.45, 0.55, m);
}

void main() {
  vec3 color = texture(uStyled, vUv).rgb;

  if (uHasSegmenter == 0) {
    outColor = vec4(color, 1.0); // full frame, no rim
    return;
  }

  float m = maskAt(vUv);
  float rim = 0.0;
  if (m > 0.5) {
    // Eight directions at two radii, reaching further toward the upper-right light.
    vec2 light = normalize(vec2(1.0, 1.0));
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.78539816;
      vec2 d = vec2(cos(a), sin(a));
      float bias = mix(0.5, 1.0, 0.5 + 0.5 * dot(d, light));
      for (int r = 0; r < 2; r++) {
        float px = (r == 0 ? 4.0 : 7.0) * bias;
        if (maskAt(vUv + d * px * uTexel) <= 0.5) rim = 1.0;
      }
    }
  }

  color = mix(color, RIM, step(0.5, rim)); // hard edge, no gradient
  outColor = vec4(color * m, m);           // premultiplied
}
