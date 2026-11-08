#version 300 es
precision highp float;

// One tilted quad per draw call (6 vertices from gl_VertexID, no buffers).
uniform vec2 uCanvas;    // output size in pixels
uniform vec2 uCenter;    // row center in pixels (y down)
uniform vec2 uHalfSize;  // unrotated half size in pixels
uniform float uTilt;     // radians
uniform float uScale;    // slam scale (2.5 -> 1.0 with overshoot)
uniform vec2 uShake;     // pixel offset (stepped)
uniform float uRow;      // 0..2 atlas row

out vec2 vUv;

void main() {
  int corners[6] = int[6](0, 1, 2, 2, 1, 3);
  int id = corners[gl_VertexID];
  vec2 c = vec2(float(id & 1), float(id >> 1)); // (0,0) (1,0) (0,1) (1,1)
  vec2 local = (c * 2.0 - 1.0) * uHalfSize * uScale;
  float cs = cos(uTilt);
  float sn = sin(uTilt);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 px = uCenter + uShake + rotated;
  vec2 ndc = vec2(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  // Atlas is uploaded unflipped: canvas top is v = 0.
  vUv = vec2(c.x, (uRow + c.y) / 3.0);
}
