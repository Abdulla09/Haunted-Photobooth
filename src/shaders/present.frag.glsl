#version 300 es
precision highp float;

uniform sampler2D uSource;
in vec2 vUv;
out vec4 outColor;

void main() {
  outColor = vec4(texture(uSource, vUv).rgb, 1.0);
}
