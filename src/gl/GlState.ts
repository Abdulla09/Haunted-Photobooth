import type { Target } from './Targets.ts';

export type BlendMode = 'off' | 'premultiplied' | 'additive';

/** Baseline GL state management shared by raw passes and Three.js hand-offs. */
export const GlState = {
  /** Sets all global state to the documented baseline (no framebuffer change). */
  applyBaseline(gl: WebGL2RenderingContext): void {
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DITHER);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);
    gl.frontFace(gl.CCW);
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.clearColor(0, 0, 0, 0);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  },

  /**
   * Starts a raw pass: binds target (null = default framebuffer), sets the
   * viewport and the blend mode. `size` is required for the default framebuffer.
   */
  begin(
    gl: WebGL2RenderingContext,
    target: Target | null,
    blend: BlendMode = 'off',
    size?: { w: number; h: number },
  ): void {
    const w = target ? target.w : (size?.w ?? gl.drawingBufferWidth);
    const h = target ? target.h : (size?.h ?? gl.drawingBufferHeight);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.blendEquation(gl.FUNC_ADD);
    if (blend === 'off') {
      gl.disable(gl.BLEND);
    } else {
      gl.enable(gl.BLEND);
      if (blend === 'premultiplied') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFunc(gl.ONE, gl.ONE);
    }
    gl.activeTexture(gl.TEXTURE0);
  },

  /** DEV-only: warns about any state that differs from the baseline. */
  assertBaseline(gl: WebGL2RenderingContext): void {
    if (!import.meta.env.DEV) return;
    const diffs: string[] = [];
    const enabled: Array<[string, number]> = [
      ['SCISSOR_TEST', gl.SCISSOR_TEST],
      ['DEPTH_TEST', gl.DEPTH_TEST],
      ['STENCIL_TEST', gl.STENCIL_TEST],
      ['CULL_FACE', gl.CULL_FACE],
      ['DITHER', gl.DITHER],
      ['POLYGON_OFFSET_FILL', gl.POLYGON_OFFSET_FILL],
      ['SAMPLE_ALPHA_TO_COVERAGE', gl.SAMPLE_ALPHA_TO_COVERAGE],
    ];
    for (const [n, cap] of enabled) if (gl.isEnabled(cap)) diffs.push(`${n} enabled`);
    if (gl.getParameter(gl.DEPTH_WRITEMASK) !== true) diffs.push('depthMask false');
    const cm = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];
    if (!cm.every(Boolean)) diffs.push('colorMask not all true');
    if (gl.getParameter(gl.FRONT_FACE) !== gl.CCW) diffs.push('frontFace not CCW');
    if (gl.getParameter(gl.BLEND_EQUATION_RGB) !== gl.FUNC_ADD) diffs.push('blendEquation not FUNC_ADD');
    if (gl.getParameter(gl.ACTIVE_TEXTURE) !== gl.TEXTURE0) diffs.push('active texture not TEXTURE0');
    if (gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) !== false) diffs.push('UNPACK_FLIP_Y set');
    if (gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) !== false) diffs.push('UNPACK_PREMULTIPLY set');
    if (gl.getParameter(gl.UNPACK_ALIGNMENT) !== 4) diffs.push('UNPACK_ALIGNMENT != 4');
    const cc = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
    if (cc[0] !== 0 || cc[1] !== 0 || cc[2] !== 0 || cc[3] !== 0) diffs.push('clearColor not zero');
    if (diffs.length) console.warn('[GlState] baseline differences:', diffs.join(', '));
  },
};
