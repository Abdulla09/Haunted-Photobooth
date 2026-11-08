#version 300 es
precision highp float;

uniform sampler2D uSource;
in vec2 vUv;
out vec4 outColor;

// Premultiplied RGBA is passed through unchanged; the pass applies
// blendFunc(ONE, ONE_MINUS_SRC_ALPHA).
void main() {
  outColor = texture(uSource, vUv);
}
