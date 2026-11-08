#version 300 es
precision highp float;

uniform sampler2D uVideo;
in vec2 vUv;
out vec4 outColor;

// Video is uploaded top-row-first (no flip), so flip Y for GL orientation
// and flip X to mirror the feed.
void main() {
  outColor = vec4(texture(uVideo, vec2(1.0 - vUv.x, 1.0 - vUv.y)).rgb, 1.0);
}
