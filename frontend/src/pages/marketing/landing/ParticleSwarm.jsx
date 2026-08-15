import { useEffect, useRef } from 'react'

/* Decorative hero backdrop: ~24k particles on a Fibonacci sphere lattice, deformed by a
   layered sine interference field so the shell breathes and tumbles.

   All per-particle work lives in the vertex shader — the only attribute is the particle
   index, so nothing is allocated per frame and the CPU never touches the swarm. Palette is
   locked to the landing page's amber on cream, drawn at low alpha so it reads as texture
   rather than a foreground element. */

const PARTICLE_COUNT = 24000

const VERT = `
precision highp float;

attribute float a_index;

uniform float u_time;
uniform float u_count;
uniform float u_aspect;
uniform float u_dpr;
uniform vec2  u_pointer;

varying float v_alpha;
varying vec3  v_color;

vec3 hsl2rgb(vec3 c) {
  vec3 k = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z + c.y * (k - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

void main() {
  float i = a_index;
  float n = (i + 0.5) / max(u_count, 1.0);
  float t = u_time;

  // Even spherical distribution (Fibonacci lattice) — no clustering at the poles.
  float phi   = acos(clamp(1.0 - 2.0 * n, -1.0, 1.0));
  float theta = 2.399963229728653 * i;

  float sp = sin(phi);
  vec3 dir = vec3(sp * cos(theta), cos(phi), sp * sin(theta));

  // Two interfering waves + a global pulse push the shell in and out.
  float wave  = sin(5.0 * phi - t * 0.62) * cos(4.0 * theta + t * 0.41);
  float ripple = sin(9.0 * phi + t * 0.33 + n * 6.2831853);
  float r = 1.0 + 0.185 * wave + 0.055 * ripple;

  vec3 p = dir * r;

  // Slow tumble, nudged by the pointer for a little parallax.
  float ay = t * 0.125 + u_pointer.x * 0.38;
  float ax = sin(t * 0.087) * 0.26 + u_pointer.y * 0.24;

  float cy = cos(ay), sy = sin(ay);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);

  float cx = cos(ax), sx = sin(ax);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);

  // Widened into an ellipsoid after the tumble so the field spans the hero at any aspect
  // without the points themselves stretching.
  p.x *= 1.95;

  // Hand-rolled perspective divide; guarded so nothing can reach infinity.
  float camZ = 3.0;
  float w = max(camZ - p.z, 0.05);
  float k = 2.6 / w;

  gl_Position = vec4(p.x * k / max(u_aspect, 0.001), p.y * k, 0.0, 1.0);
  gl_PointSize = clamp(k * 3.2 * u_dpr, 1.5, 9.0);

  // Depth 0 = far, 1 = near. Near particles sit darker and denser on the cream ground.
  float depth = clamp((p.z + 1.3) / 2.6, 0.0, 1.0);

  float hue = 0.065 + 0.042 * clamp(r - 0.82, 0.0, 1.0) - 0.010 * depth;
  float lightness = mix(0.62, 0.34, depth);

  v_color = hsl2rgb(vec3(hue, 0.88, lightness));
  v_alpha = 0.16 + 0.50 * depth;
}
`

const FRAG = `
precision mediump float;

varying float v_alpha;
varying vec3  v_color;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.25, 0.015, dot(d, d));
  if (a <= 0.0) discard;
  gl_FragColor = vec4(v_color, v_alpha * a);
}
`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export default function ParticleSwarm({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const gl =
      canvas.getContext('webgl', { alpha: true, antialias: false, depth: false }) ||
      canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false })
    if (!gl) return undefined

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) return undefined

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      return undefined
    }
    gl.useProgram(program)

    const indices = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i += 1) indices[i] = i

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW)

    const aIndex = gl.getAttribLocation(program, 'a_index')
    gl.enableVertexAttribArray(aIndex)
    gl.vertexAttribPointer(aIndex, 1, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, 'u_time')
    const uCount = gl.getUniformLocation(program, 'u_count')
    const uAspect = gl.getUniformLocation(program, 'u_aspect')
    const uDpr = gl.getUniformLocation(program, 'u_dpr')
    const uPointer = gl.getUniformLocation(program, 'u_pointer')

    gl.uniform1f(uCount, PARTICLE_COUNT)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    let dpr = 1
    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      if (!clientWidth || !clientHeight) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(clientWidth * dpr)
      canvas.height = Math.round(clientHeight * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uAspect, clientWidth / Math.max(clientHeight, 1))
      gl.uniform1f(uDpr, dpr)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Pointer parallax, eased toward the target so the tumble never snaps.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const onPointerMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const start = performance.now()

    const draw = (time) => {
      gl.uniform1f(uTime, time)
      gl.uniform2f(uPointer, pointer.x, pointer.y)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT)
    }

    const loop = (now) => {
      frame = requestAnimationFrame(loop)
      pointer.x += (pointer.tx - pointer.x) * 0.045
      pointer.y += (pointer.ty - pointer.y) * 0.045
      draw((now - start) / 1000)
    }

    const startLoop = () => {
      if (frame) return
      if (reduceMotion.matches) {
        draw(0)
        return
      }
      frame = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      if (!frame) return
      cancelAnimationFrame(frame)
      frame = 0
    }

    const onVisibility = () => (document.hidden ? stopLoop() : startLoop())
    const onMotionChange = () => {
      stopLoop()
      startLoop()
    }
    document.addEventListener('visibilitychange', onVisibility)
    reduceMotion.addEventListener('change', onMotionChange)

    startLoop()

    return () => {
      stopLoop()
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibility)
      reduceMotion.removeEventListener('change', onMotionChange)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden='true' />
}
