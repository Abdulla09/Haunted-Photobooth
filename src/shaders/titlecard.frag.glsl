#version 300 es
precision highp float;

uniform sampler2D uAtlas; // premultiplied RGBA
uniform float uAlpha;

in vec2 vUv;
out vec4 outColor;

void main() {
  outColor = texture(uAtlas, vUv) * uAlpha;
}
