/**
 * Shared fullscreen-triangle VAO. The vertex shader derives positions from
 * gl_VertexID, so there are no buffers or attributes.
 */
export class Quad {
  readonly vao: WebGLVertexArrayObject;
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.gl = gl;
    this.vao = vao;
  }

  draw(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vao);
  }
}
