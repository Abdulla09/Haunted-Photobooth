#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2 uStep; // UV offset of one tap: (1/w, 0) horizontal, (0, 1/h) vertical
in vec2 vUv;
out vec4 outColor;

// One direction of a separable 9-tap Gaussian (center + 4 taps per side).
void main() {
  float w[5] = float[5](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);
  float sum = texture(uSrc, vUv).r * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = uStep * float(i);
    sum += texture(uSrc, vUv + o).r * w[i];
    sum += texture(uSrc, vUv - o).r * w[i];
  }
  outColor = vec4(sum, sum, sum, 1.0);
}
