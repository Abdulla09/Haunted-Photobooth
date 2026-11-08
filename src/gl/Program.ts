type UniformValue = number | readonly number[];

/** Compiled/linked program with a cached uniform-location lookup. */
export class Program {
  readonly program: WebGLProgram;
  private gl: WebGL2RenderingContext;
  private locations = new Map<string, WebGLUniformLocation | null>();

  constructor(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string, name = 'program') {
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertSrc, `${name}.vert`);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, `${name}.frag`);
    const prog = gl.createProgram();
    if (!prog) throw new Error(`${name}: failed to create program`);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? '';
      gl.deleteProgram(prog);
      throw new Error(`${name}: link failed\n${log}`);
    }
    this.program = prog;
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  loc(name: string): WebGLUniformLocation | null {
    let l = this.locations.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, l);
    }
    return l;
  }

  /** Sets a float/vec2/vec3/vec4 uniform (program must be in use). */
  setFloat(name: string, v: UniformValue): void {
    const l = this.loc(name);
    if (!l) return;
    const gl = this.gl;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    else throw new Error(`Unsupported uniform length for ${name}`);
  }

  setInt(name: string, v: number): void {
    const l = this.loc(name);
    if (l) this.gl.uniform1i(l, v);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.locations.clear();
  }
}

function compile(gl: WebGL2RenderingContext, type: number, src: string, label: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error(`${label}: failed to create shader`);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? '';
    gl.deleteShader(sh);
    throw new Error(`${label}: compile failed\n${log}`);
  }
  return sh;
}
