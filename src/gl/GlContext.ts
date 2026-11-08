/** Owns the Output_Canvas and its single WebGL2 context. */
export class GlContext {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  width = 0;
  height = 0;
  lost = false;
  private lostListeners: Array<() => void> = [];

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      for (const l of this.lostListeners) l();
    });
  }

  /** Returns null when WebGL2 is unavailable. */
  static create(canvas: HTMLCanvasElement = document.createElement('canvas')): GlContext | null {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return null;
    return new GlContext(canvas, gl);
  }

  /** Sets the internal canvas resolution (CSS size is handled elsewhere). */
  setSize(w: number, h: number): void {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  onContextLost(cb: () => void): void {
    this.lostListeners.push(cb);
  }

  loseContext(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
