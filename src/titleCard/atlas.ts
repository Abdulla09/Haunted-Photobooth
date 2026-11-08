import { PALETTE_HEX } from '../app/palette';

/** Title text exists only as these canvas-baked constants (never in the DOM). */
export const TITLE_ROWS = ['HAUNTED', 'PHOTO', 'BOOTH'] as const;

export const ATLAS_W = 2048;
export const ATLAS_H = 768;
const ROW_H = ATLAS_H / TITLE_ROWS.length;

const FONT_STACK = 'Impact, "Arial Black", "Haettenschweiler", system-ui, sans-serif';
const FILLS = [PALETTE_HEX.toxicGreen, PALETTE_HEX.pumpkinOrange, PALETTE_HEX.bone] as const;
const OUTLINE_WIDTH = 30;
const SHADOW_OFFSET = 14;

/** Bakes the three title rows into a 2048x768 2D canvas (row i occupies y in [i*256, (i+1)*256)). */
export function bakeTitleAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for title atlas');

  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.miterLimit = 2;

  const maxTextW = ATLAS_W - OUTLINE_WIDTH * 2 - SHADOW_OFFSET - 40;
  const maxTextH = ROW_H - OUTLINE_WIDTH - SHADOW_OFFSET - 16;

  TITLE_ROWS.forEach((text, i) => {
    let size = Math.floor(maxTextH);
    ctx.font = `900 ${size}px ${FONT_STACK}`;
    const measured = ctx.measureText(text).width;
    if (measured > maxTextW) {
      size = Math.floor((size * maxTextW) / measured);
      ctx.font = `900 ${size}px ${FONT_STACK}`;
    }
    const cx = (ATLAS_W - SHADOW_OFFSET) / 2;
    const cy = i * ROW_H + (ROW_H - SHADOW_OFFSET) / 2;

    // Hard purple shadow (outlined silhouette, no blur).
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.strokeStyle = PALETTE_HEX.deepPurple;
    ctx.fillStyle = PALETTE_HEX.deepPurple;
    ctx.strokeText(text, cx + SHADOW_OFFSET, cy + SHADOW_OFFSET);
    ctx.fillText(text, cx + SHADOW_OFFSET, cy + SHADOW_OFFSET);

    // Thick round-joined black outline, then palette fill.
    ctx.strokeStyle = PALETTE_HEX.black;
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = FILLS[i];
    ctx.fillText(text, cx, cy);
  });

  return canvas;
}

/**
 * Uploads the atlas as an RGBA8 texture. Premultiplied alpha is enabled only
 * during the upload and restored to the baseline (false) afterwards.
 */
export function uploadAtlas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create title atlas texture');
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
