#version 300 es
precision highp float;

uniform sampler2D uStyled;   // flat duotone bands (rgb) + band index (a), half-res, NEAREST
uniform sampler2D uMask;     // R8 person mask, unmirrored, top-row-first
uniform vec2 uTexel;         // 1 / output size
uniform int uHasSegmenter;
uniform vec3 uInk;           // midnight
uniform vec3 uMint;          // ghost mint
in vec2 vUv;
out vec4 outColor;

// Mask is inferred on the unmirrored frame: mirror X, flip Y.
float maskAt(vec2 uv) {
  float m = texture(uMask, vec2(1.0 - uv.x, 1.0 - uv.y)).r;
  return smoothstep(0.45, 0.55, m);
}

float bandAt(vec2 uv) {
  return texture(uStyled, uv).a;
}

// Sobel on the posterized band index; hard 0/1 result.
float inkEdge(vec2 uv) {
  vec2 t = 1.0 / vec2(textureSize(uStyled, 0)); // one half-res texel (~2 output px)
  float tl = bandAt(uv + vec2(-t.x,  t.y));
  float tc = bandAt(uv + vec2( 0.0,  t.y));
  float tr = bandAt(uv + vec2( t.x,  t.y));
  float ml = bandAt(uv + vec2(-t.x,  0.0));
  float mr = bandAt(uv + vec2( t.x,  0.0));
  float bl = bandAt(uv + vec2(-t.x, -t.y));
  float bc = bandAt(uv + vec2( 0.0, -t.y));
  float br = bandAt(uv + vec2( t.x, -t.y));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
  // Band steps are multiples of 1/3; a single-band step gives magnitude >= 1/3 * 2.
  return step(0.5, length(vec2(gx, gy)));
}

void main() {
  vec3 color = texture(uStyled, vUv).rgb;
  float ink = inkEdge(vUv);

  if (uHasSegmenter == 0) {
    outColor = vec4(mix(color, uInk, ink), 1.0); // full frame, ink lines, no glow
    return;
  }

  float m = maskAt(vUv);

  // Silhouette: hard mint line at the mask edge, ink line just inside it.
  float mintLine = 0.0;
  float inkLine = 0.0;
  float ringSum = 0.0;
  float ringW = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.78539816;
    vec2 d = vec2(cos(a), sin(a));
    if (m > 0.5) {
      if (maskAt(vUv + d * 2.0 * uTexel) <= 0.5) mintLine = 1.0;
      if (maskAt(vUv + d * 4.0 * uTexel) <= 0.5) inkLine = 1.0;
    } else {
      ringSum += maskAt(vUv + d * 6.0 * uTexel) * 1.0;
      ringSum += maskAt(vUv + d * 12.0 * uTexel) * 0.8;
      ringSum += maskAt(vUv + d * 20.0 * uTexel) * 0.6;
      ringW += 2.4;
    }
  }

  if (m > 0.5) {
    vec3 c = color;
    c = mix(c, uInk, max(ink, inkLine));
    c = mix(c, uMint, mintLine);
    outColor = vec4(c, 1.0);
  } else {
    // Soft outer glow falling off away from the silhouette (premultiplied).
    float g = clamp(ringSum / ringW * 2.2, 0.0, 1.0);
    g = g * g * 0.85;
    outColor = vec4(uMint * g, g);
  }
}
