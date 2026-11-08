import { CONFIG } from '../app/config.ts';

function setupTexture(gl: WebGL2RenderingContext, tex: WebGLTexture): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** Plain RGBA8 video texture (no sRGB format; display-referred values). */
export function createVideoTexture(gl: WebGL2RenderingContext, w = 1, h = 1): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create video texture');
  setupTexture(gl, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** Uploads the current video frame. Pixel-store defaults are left untouched. */
export function uploadVideoFrame(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  video: HTMLVideoElement,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

/** R8 mask texture, allocated once with immutable storage. */
export function createMaskTexture(
  gl: WebGL2RenderingContext,
  size: number = CONFIG.MASK_SIZE,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create mask texture');
  setupTexture(gl, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, size, size);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** Uploads a size x size u8 mask with UNPACK_ALIGNMENT=1, restoring 4 after. */
export function uploadMask(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  data: Uint8Array,
  size: number = CONFIG.MASK_SIZE,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
