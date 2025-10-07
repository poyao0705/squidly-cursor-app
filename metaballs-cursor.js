// metaballs-cursor.js
/**
 * WebGL MetaBalls Cursor (OGL)
 * Mirrors the API of WebGLFluidCursor/WebGLBallpitCursor so app.js can switch to it.
 * - Overlay <canvas> fixed to viewport (or iframe bounds)
 * - Unified InputManager drives iMouse uniform
 * - Proper resource cleanup via destroy()
 */

import InputManager from './input-manager.js';

// Dynamically import OGL (Renderer, Program, Mesh, Triangle, Transform, Vec3)
const oglCdn = 'https://cdn.jsdelivr.net/npm/ogl@0.0.95/src/index.mjs';

function parseHexColor(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16)/255;
  const g = parseInt(c.slice(2,4),16)/255;
  const b = parseInt(c.slice(4,6),16)/255;
  return [r,g,b];
}

function fract(x){ return x - Math.floor(x); }
function hash31(p){
  let r=[p*0.1031,p*0.103,p*0.0973].map(fract);
  const yzx=[r[1],r[2],r[0]];
  const dotVal = r[0]*(yzx[0]+33.33)+r[1]*(yzx[1]+33.33)+r[2]*(yzx[2]+33.33);
  for(let i=0;i<3;i++) r[i]=fract(r[i]+dotVal);
  return r;
}
function hash33(v){
  let p=[v[0]*0.1031,v[1]*0.103,v[2]*0.0973].map(fract);
  const yxz=[p[1],p[0],p[2]];
  const dotVal=p[0]*(yxz[0]+33.33)+p[1]*(yxz[1]+33.33)+p[2]*(yxz[2]+33.33);
  for(let i=0;i<3;i++) p[i]=fract(p[i]+dotVal);
  const xxy=[p[0],p[0],p[1]], yxx=[p[1],p[0],p[0]], zyx=[p[2],p[1],p[0]];
  const out=[]; for(let i=0;i<3;i++) out[i]=fract((xxy[i]+yxx[i])*zyx[i]); return out;
}

const vertex = `#version 300 es
precision highp float;
layout(location = 0) in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;

// keep these for backwards-compat; we'll still set iMouse to “primary” pointer
uniform vec3 iMouse;

uniform vec3 iColor;          // base metaballs color
uniform float iAnimationSize;
uniform int iBallCount;
uniform vec3 iMetaBalls[50];
uniform float iClumpFactor;
uniform bool enableTransparency;

// NEW: multi-pointer support
uniform int iPointerCount;
uniform vec3 iPointerPosRad[16];   // xy = pixel position, z = radius
uniform vec3 iPointerColors[16];   // per-pointer color

out vec4 outColor;

float getMetaBallValue(vec2 c, float r, vec2 p){
  vec2 d = p - c;
  float dist2 = dot(d, d);
  return (r*r) / max(dist2, 1e-4);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float scale = iAnimationSize / iResolution.y;
  vec2 coord = (fc - iResolution.xy * 0.5) * scale;

  // world space positions for animated balls
  float mAnim = 0.0;
  for (int i=0;i<50;i++){
    if (i >= iBallCount) break;
    mAnim += getMetaBallValue(iMetaBalls[i].xy, iMetaBalls[i].z, coord);
  }

  // multi-pointer metaballs + color accumulation
  float mPtrs = 0.0;
  vec3 ptrColorAcc = vec3(0.0);
  for (int j=0;j<16;j++){
    if (j >= iPointerCount) break;
    vec2 c = (iPointerPosRad[j].xy - iResolution.xy * 0.5) * scale;
    float r = iPointerPosRad[j].z;
    float v = getMetaBallValue(c, r, coord);
    mPtrs += v;
    ptrColorAcc += iPointerColors[j] * v;
  }

  float total = mAnim + mPtrs;

  // maintain the same soft edge behavior
  float f = smoothstep(-1.0, 1.0, (total - 1.3) / min(1.0, fwidth(total)));

  vec3 cFinal = vec3(0.0);
  if (total > 0.0) {
    cFinal = iColor * (mAnim / total) + (ptrColorAcc / max(total, 1e-4));
  }

  outColor = vec4(cFinal * f, enableTransparency ? f : 1.0);
}
`;

class WebGLMetaBallsCursor {
  constructor({ configOverrides = {}, autoMouseEvents = false } = {}) {
    this.ready = false;
    this.ogl = null;
    this.renderer = null;
    this.gl = null;
    this.scene = null;
    this.camera = null;
    this.mesh = null;
    this.program = null;
    this.metaBalls = [];
    this.ballParams = [];
    this.animationId = null;

    // mirror your other cursors' config style
    this.config = Object.assign(
      {
        BALL_COUNT: 15,
        ANIMATION_SIZE: 30,
        CURSOR_BALL_SIZE: 3,
        SPEED: 0.3,
        CLUMP_FACTOR: 1.0,
        HOVER_SMOOTHNESS: 0.05,
        COLOR: [1, 1, 1],
        CURSOR_COLOR: [1, 1, 1],
        ENABLE_TRANSPARENCY: true,
        CURSOR_INTERACTION: true
      },
      configOverrides || {}
    );

    // === overlay canvas like the others
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed',
      zIndex: '9999',
      pointerEvents: 'none',
      background: 'transparent'
    });
    document.body.appendChild(this.canvas);
    this._updateCanvasPosition();

    // unified inputs (treat as "fluid" branch so InputManager calls our _updatePointerMoveData)
    this.inputManager = new InputManager(this, {
      cursorType: 'fluid',     // <- reuse fluid path in InputManager
      useBallAssignment: false,
      inactiveTimeout: 5000
    });

    // optional auto mouse (kept for parity with your other cursors)
    this._autoMouse = autoMouseEvents;
    if (this._autoMouse) {
      this._onMouseMove = (e) =>
        this.inputManager.updatePointerPosition(e.clientX, e.clientY, null, 'mouse');
      window.addEventListener('mousemove', this._onMouseMove, { passive: true });
    }

    // events
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    this._init().catch(console.error);
  }

  // === public API (pause/play are no-ops here, kept for symmetry) =========
  pause() { /* optional to implement */ }
  play() { /* optional to implement */ }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this._onResize);
    if (this._autoMouse && this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
    try { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch {}
    this.canvas?.parentElement?.removeChild(this.canvas);
    this.ready = false;
  }

  // === input plumbing expected by InputManager's "fluid" branch =============
  _scaleByPixelRatio(v){ return Math.floor(v * (window.devicePixelRatio || 1)); }
  _pointerKey(id="default"){ return `mouse:${id}`; }
  _createPointer(_type="mouse", id="default"){
    return { id, texcoordX: 0, texcoordY: 0, moved: false, color: null, deltaX:0, deltaY:0 };
  }
  _registerPointer(id="default", color=null){
    this.pointerMap ||= new Map();
    const key = this._pointerKey(id);
    if (this.pointerMap.has(key)) return this.pointerMap.get(key);
    const p = this._createPointer("mouse", id);
    if (Array.isArray(color)) p.color = color;
    this.pointerMap.set(key, p);
    return p;
  }
  _getOrCreatePointer(id="default", color=null){
    const key = this._pointerKey(id);
    return this.pointerMap?.get(key) ?? this._registerPointer(id, color);
  }
  _updatePointerMoveData(pointer, px, py /*, color */){
    // convert screen px -> canvas pixels & set iMouse
    const x = px;
    const y = this.gl.canvas.height - py; // Invert Y coordinate for WebGL
    // Cache smoothed mouse on our side; uniforms get set each frame
    this._targetMouseX = x;
    this._targetMouseY = y;
  }

  // === setup ================================================================
  async _init() {
    this.ogl = await import(oglCdn);
    const {Renderer, Camera, Triangle, Program, Mesh, Transform, Vec3} = this.ogl;

    this.renderer = new Renderer({
      canvas: this.canvas,
      dpr: 1,
      alpha: true,
      premultipliedAlpha: false
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, this.config.ENABLE_TRANSPARENCY ? 0 : 1);

    // camera for fullscreen tri
    this.camera = new Camera(this.gl, { left:-1, right:1, top:1, bottom:-1, near:0.1, far:10 });
    this.camera.position.z = 1;

    const geometry = new Triangle(this.gl);

    // uniforms
    const iResolution = new Vec3(0,0,0);
    const iMouse = new Vec3(0,0,0);

    const [r1,g1,b1] = this.config.COLOR;
    const [r2,g2,b2] = this.config.CURSOR_COLOR;

    // pre-alloc metaballs
    for (let i=0;i<50;i++) this.metaBalls.push(new this.ogl.Vec3(0,0,0));

    this.program = new Program(this.gl, {
      vertex, fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: iResolution },
        iMouse: { value: iMouse },
        iColor: { value: new this.ogl.Vec3(r1,g1,b1) },
        iCursorColor: { value: new this.ogl.Vec3(r2,g2,b2) },
        iAnimationSize: { value: this.config.ANIMATION_SIZE },
        iBallCount: { value: Math.min(this.config.BALL_COUNT, 50) },
        iCursorBallSize: { value: this.config.CURSOR_BALL_SIZE },
        iMetaBalls: { value: this.metaBalls },
        iClumpFactor: { value: this.config.CLUMP_FACTOR },
        enableTransparency: { value: !!this.config.ENABLE_TRANSPARENCY },
      }
    });

    // after this.program = new Program(...):
    this.MAX_POINTERS = 16;
    this.pointerPosRad = [];
    this.pointerColors = [];
    for (let i = 0; i < this.MAX_POINTERS; i++) {
    this.pointerPosRad.push(new this.ogl.Vec3(0, 0, 0));
    this.pointerColors.push(new this.ogl.Vec3(1, 1, 1));
    }

    Object.assign(this.program.uniforms, {
    iPointerCount: { value: 0 },
    iPointerPosRad: { value: this.pointerPosRad },
    iPointerColors: { value: this.pointerColors },
    });


    this.mesh = new Mesh(this.gl, { geometry, program: this.program });
    this.scene = new Transform();
    this.mesh.setParent(this.scene);

    // seed metaball params
    const n = Math.min(this.config.BALL_COUNT, 50);
    for (let i=0;i<n;i++){
      const idx = i+1;
      const h1 = hash31(idx);
      const st = h1[0] * (2*Math.PI);
      const dtFactor = 0.1*Math.PI + h1[1]*(0.4*Math.PI - 0.1*Math.PI);
      const baseScale = 5.0 + h1[1] * (10.0 - 5.0);
      const h2 = hash33(h1);
      const toggle = Math.floor(h2[0]*2.0);
      const radius = 0.5 + h2[2]*(2.0 - 0.5);
      this.ballParams.push({ st, dtFactor, baseScale, toggle, radius });
    }

    this._onResize(); // set size + iResolution

    // animation state
    this._mouseX = this.gl.canvas.width * 0.5;
    this._mouseY = this.gl.canvas.height * 0.5;
    this._targetMouseX = this._mouseX;
    this._targetMouseY = this._mouseY;

    this._startT = performance.now();
    this.ready = true;
    this._loop();
  }

  _onResize(){
    this._updateCanvasPosition();
    const w = Math.floor((window.frameElement?.clientWidth ?? window.innerWidth) * (window.devicePixelRatio||1));
    const h = Math.floor((window.frameElement?.clientHeight ?? window.innerHeight) * (window.devicePixelRatio||1));
    this.renderer.setSize(w, h);
    this.canvas.style.width = (window.frameElement?.clientWidth ?? window.innerWidth) + 'px';
    this.canvas.style.height = (window.frameElement?.clientHeight ?? window.innerHeight) + 'px';
    this.program.uniforms.iResolution.value.set(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight, 0);
  }

  _updateCanvasPosition() {
    const iframe = window.frameElement;
    if (iframe) {
      const r = iframe.getBoundingClientRect();
      this.canvas.style.top = r.top + 'px';
      this.canvas.style.left = r.left + 'px';
      this.canvas.style.width = r.width + 'px';
      this.canvas.style.height = r.height + 'px';
    } else {
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
    }
  }

  _loop(){
    this.animationId = requestAnimationFrame(() => this._loop());
    if (!this.ready) return;

    const t = (performance.now() - this._startT) * 0.001;
    this.program.uniforms.iTime.value = t;

    // animate balls
    const s = this.config.SPEED, cf = this.config.CLUMP_FACTOR;
    for (let i=0;i<this.ballParams.length;i++){
      const p = this.ballParams[i];
      const dt = t * s * p.dtFactor;
      const th = p.st + dt;
      const x = Math.cos(th);
      const y = Math.sin(th + dt * p.toggle);
      const posX = x * p.baseScale * cf;
      const posY = y * p.baseScale * cf;
      this.metaBalls[i].set(posX, posY, p.radius);
    }

    // smooth pointer
    const ease = this.config.HOVER_SMOOTHNESS;
    const inside = this.config.CURSOR_INTERACTION; // always true via InputManager updates
    let targetX = this._targetMouseX, targetY = this._targetMouseY;

    // if no input yet, idle orbit
    if (!inside && (this._targetMouseX===undefined)) {
      const cx = this.gl.canvas.width * 0.5;
      const cy = this.gl.canvas.height * 0.5;
      const rx = this.gl.canvas.width * 0.15;
      const ry = this.gl.canvas.height * 0.15;
      targetX = cx + Math.cos(t * s) * rx;
      targetY = cy + Math.sin(t * s) * ry;
    }

    this._mouseX += (targetX - this._mouseX) * ease;
    this._mouseY += (targetY - this._mouseY) * ease;
    this.program.uniforms.iMouse.value.set(this._mouseX, this._mouseY, 0);

    // update pointer data
    // Gather active pointers (mouse + others)
    const active = this.inputManager.getActivePointers(); // [{id,x,y,color,...}, ...]
    let count = 0;

    for (let i = 0; i < active.length && count < this.MAX_POINTERS; i++) {
    const p = active[i];

    // Convert to canvas pixels & invert Y for WebGL-style coords
    const xPix = this._scaleByPixelRatio(p.x);
    const yPix = this.gl.canvas.height - this._scaleByPixelRatio(p.y);

    // radius per-pointer (could vary by pointer later)
    const rad = this.config.CURSOR_BALL_SIZE;

    this.pointerPosRad[count].set(xPix, yPix, rad);

    // use pointer color if present, else default cursor color
    const col = Array.isArray(p.color) ? p.color : this.config.CURSOR_COLOR;
    this.pointerColors[count].set(col[0], col[1], col[2]);

    count++;
    }

    this.program.uniforms.iPointerCount.value = count;

    // (Optional) still set iMouse to the “primary” pointer for any other logic
    const primary = this.inputManager.getTargetPointer(); // mouse preferred
    if (primary) {
    const xPix = this._scaleByPixelRatio(primary.x);
    const yPix = this.gl.canvas.height - this._scaleByPixelRatio(primary.y);
    this.program.uniforms.iMouse.value.set(xPix, yPix, 0);
    }


    this.renderer.render({ scene: this.scene, camera: this.camera });
  }
}

// Exports consistent with your other cursor modules
export default WebGLMetaBallsCursor;
export { WebGLMetaBallsCursor };
