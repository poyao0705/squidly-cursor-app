/**
 * WebGL Fluid Cursor
 * 
 * A high-performance WebGL-based fluid simulation that creates realistic fluid trails
 * following cursor movement. Uses advanced fluid dynamics algorithms including
 * velocity advection, pressure projection, and vorticity confinement.
 * 
 * Features:
 * - Real-time WebGL fluid simulation with custom shaders
 * - Multi-pointer support for mouse, touch, and eye gaze input
 * - Configurable fluid properties (density, velocity, pressure)
 * - Automatic canvas positioning and iframe support
 * - Resource management and cleanup
 * 
 * @author Squidly Team
 * @version 1.0.0
 * @class WebGLFluidCursor
 */

// Import InputManager
import InputManager from './input-manager.js';

class WebGLFluidCursor {
  /**
   * Create a new WebGLFluidCursor instance
   * 
   * @param {Object} [opts={}] - Configuration options
   * @param {Object} [opts.configOverrides={}] - Override simulation configuration
   * @param {boolean} [opts.autoMouseEvents=false] - Whether to automatically handle mouse events
   * 
   * @example
   * // Basic usage
   * const fluidCursor = new WebGLFluidCursor();
   * 
   * // With custom configuration
   * const fluidCursor = new WebGLFluidCursor({
   *   configOverrides: {
   *     SPLAT_RADIUS: 0.3,
   *     SPLAT_FORCE: 8000,
   *     COLOR_UPDATE_SPEED: 10
   *   },
   *   autoMouseEvents: true
   * });
   */
  constructor({ configOverrides = {}, autoMouseEvents = false, onReady = null } = {}) {
    /** @type {Function|null} Callback function called when cursor is ready */
    this.onReady = onReady;
    
    /** @type {HTMLCanvasElement|null} The WebGL canvas element */
    this.canvas = null;
    
    /** @type {WebGLRenderingContext|WebGL2RenderingContext|null} WebGL rendering context */
    this.gl = null;
    
    /** @type {Object|null} WebGL extensions and capabilities */
    this.ext = null;
    
    /** @type {number|null} Animation frame ID for cleanup */
    this.animationId = null;
    
    /** @type {Array<Object>} Array of active pointer objects */
    this.pointers = [];
    
    /** @type {Map<string, Object>} Fast lookup map for pointers by ID */
    this.pointerMap = new Map();
    
    /** @type {Object} Input manager for handling multiple input sources */
    this.inputManager = new InputManager(this, {
      cursorType: 'fluid',
      useBallAssignment: false,
      inactiveTimeout: 5000
    });

    /** @type {Object} Simulation configuration with defaults */
    this.config = Object.assign(
      {
        SIM_RESOLUTION: 128,        // Simulation resolution (lower = better performance)
        DYE_RESOLUTION: 1024,       // Dye resolution (higher = better quality)
        CAPTURE_RESOLUTION: 512,    // Capture resolution for screenshots
        DENSITY_DISSIPATION: 1,     // How quickly density fades (0.1-2.0)
        VELOCITY_DISSIPATION: 3,    // How quickly velocity fades (0.1-5.0)
        PRESSURE: 0.1,              // Pressure solver iterations
        PRESSURE_ITERATIONS: 20,    // Number of pressure projection iterations
        CURL: 3,                    // Vorticity confinement strength
        SPLAT_RADIUS: 0.2,          // Size of fluid splashes (0.1-1.0)
        SPLAT_FORCE: 6000,          // Force applied by splashes (1000-10000)
        SHADING: true,              // Enable shading effects
        COLOR_UPDATE_SPEED: 10,     // Speed of color transitions (1-20)
        BACK_COLOR: { r: 0, g: 0, b: 0 }, // Background color
        TRANSPARENT: true,          // Enable transparency
        PAUSED: false,              // Pause simulation
      },
      configOverrides
    );

    // Register default mouse pointer
    this._registerPointer("mouse", "#00ff88");

    // framebuffers
    this.dye = null;
    this.velocity = null;
    this.divergence = null;
    this.curl = null;
    this.pressure = null;

    // timing
    this.lastUpdateTime = Date.now();
    this.colorUpdateTimer = 0;

    // programs
    this.copyProgram = null;
    this.clearProgram = null;
    this.splatProgram = null;
    this.advectionProgram = null;
    this.divergenceProgram = null;
    this.curlProgram = null;
    this.vorticityProgram = null;
    this.pressureProgram = null;
    this.gradientSubtractProgram = null;

    // util
    this.blit = null;

    // init
    this._initCanvas();
    const { gl, ext } = this._getWebGLContext(this.canvas);
    if (!ext.supportLinearFiltering) {
      this.config.DYE_RESOLUTION = 256;
      this.config.SHADING = false;
    }
    this.gl = gl;
    this.ext = ext;

    this._initShaders();
    this._initFramebuffers();
    this._initBlit();

    this.resizeCanvas();

    // Add resize listener for window resizing
    this._onResize = this._onResize.bind(this);
    window.addEventListener("resize", this._onResize);

    // Add mouse event listeners
    // Only add mouse events if explicitly requested
    if (autoMouseEvents) {
        // Add mouse event listeners
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        // _onMouseUp is commented out, so skip binding and event listener
        window.addEventListener("mousemove", this._onMouseMove, { passive: true });
        window.addEventListener("mousedown", this._onMouseDown, { passive: true });
        // window.addEventListener("mouseup", this._onMouseUp, { passive: true });
    }

    // console.log("Fluid cursor constructor completed, starting animation loop");
    // // console.log("Canvas:", this.canvas);
    // console.log("Canvas dimensions:", this.canvas.width, this.canvas.height);
    // console.log("Canvas style:", this.canvas.style.cssText);
    
    // Start frame loop immediately and signal readiness
    this._updateFrame();
    if (typeof this.onReady === "function") {
      try { this.onReady(this); } catch (e) { console.warn("onReady callback error", e); }
    }
  }

  // === Public API ==========================================================

  /**
   * Manually create a splash at specific client pixel coordinates
   * 
   * Creates an immediate fluid splash effect at the specified coordinates.
   * Useful for programmatic effects or initializing the fluid simulation.
   * 
   * @param {number} x - X coordinate in client pixels
   * @param {number} y - Y coordinate in client pixels
   * @param {Array<number>} [color=[0.5, 0.5, 0.5]] - RGB color array (0-1 range)
   * @param {string} [id="default"] - Pointer ID for the splash
   * 
   * @example
   * // Create a red splash at center of screen
   * fluidCursor.splashAtClient(400, 300, [1, 0, 0], "splash");
   * 
   * @public
   */
  splashAtClient(x, y, color = [0.5, 0.5, 0.5], id = "default") {
    const posX = this._scaleByPixelRatio(x);
    const posY = this._scaleByPixelRatio(y);
    const p = this._getOrCreatePointer(id, color); // Use mouse pointer for manual splashes
    p.texcoordX = posX / this.canvas.width;
    p.texcoordY = 1.0 - posY / this.canvas.height;
    p.deltaX = 0;
    p.deltaY = 0;
    p.moved = true;
    p.color = color;
  }

  /**
   * Destroy the fluid cursor and clean up all resources
   * 
   * Safely destroys the WebGL context, removes event listeners, clears
   * all pointers, and removes the canvas from the DOM. Should be called
   * when the cursor is no longer needed to prevent memory leaks.
   * 
   * @example
   * // Clean up when switching to another cursor
   * fluidCursor.destroy();
   * 
   * @public
   */
  destroy() {
    // console.log("Fluid cursor destroy called");
    
    // Stop animation first
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Remove event listeners
    window.removeEventListener("resize", this._onResize);
    if (this._onMouseMove) window.removeEventListener("mousemove", this._onMouseMove);
    if (this._onMouseDown) window.removeEventListener("mousedown", this._onMouseDown);
    // _onMouseUp is commented out, so skip removal
    // if (this._onMouseUp) window.removeEventListener("mouseup", this._onMouseUp);
    
    // Clear pointer maps before destroying canvas
    this.pointers = [];
    this.pointerMap.clear();
    
    // Clean up WebGL resources
    if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl = null;
    }
    
    // Remove canvas from DOM last
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    
  }

  // === Event handlers ======================================================

  _onMouseMove(e, id = "default") {
    this.inputManager.updatePointerPosition(
      e.clientX,
      e.clientY,
      null,
      id
    );
  }

  _onMouseDown(e, id = "default") {
    const pointer = this._getOrCreatePointer(id);
    const posX = this._scaleByPixelRatio(e.clientX);
    const posY = this._scaleByPixelRatio(e.clientY);
    this._updatePointerDownData(pointer, -1, posX, posY);
    this._clickSplat(pointer);
  }

//   _onMouseUp(e, id = "default") {
//     const pointer = this._getOrCreatePointer("mouse", id);
//     this._updatePointerUpData(pointer);
//   }

  _onResize() {
    // Update canvas position and size
    this._updateCanvasPosition();
    if (this.resizeCanvas()) this._initFramebuffers();
  }
  
  _updateCanvasPosition() {
    const iframe = window.frameElement;
    if (iframe) {
      // Update position relative to iframe
      const iframeRect = iframe.getBoundingClientRect();
      this.canvas.style.top = iframeRect.top + "px";
      this.canvas.style.left = iframeRect.left + "px";
      this.canvas.style.width = iframeRect.width + "px";
      this.canvas.style.height = iframeRect.height + "px";
    } else {
      // Fallback to full window
      this.canvas.style.top = "0";
      this.canvas.style.left = "0";
      this.canvas.style.width = "100vw";
      this.canvas.style.height = "100vh";
    }
  }

  // === Canvas & GL init ====================================================

  _initCanvas() {
    const c = document.createElement("canvas");
    c.style.position = "fixed";
    c.style.pointerEvents = "none";
    c.style.zIndex = "9999";
    c.style.background = "transparent";
    
    // Check if we're in an iframe and position accordingly
    const iframe = window.frameElement;
    if (iframe) {
      // Position relative to iframe
      const iframeRect = iframe.getBoundingClientRect();
      c.style.top = iframeRect.top + "px";
      c.style.left = iframeRect.left + "px";
      c.style.width = iframeRect.width + "px";
      c.style.height = iframeRect.height + "px";
    } else {
      // Fallback to full window
      c.style.top = "0";
      c.style.left = "0";
      c.style.width = "100vw";
      c.style.height = "100vh";
    }
    
    // Don't modify the container's position - append to body instead
    // console.log("Appending canvas to body:", c);
    document.body.appendChild(c);
    this.canvas = c;
    // console.log("Canvas appended successfully");
  }

  _getWebGLContext(canvas) {
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
    };
    // console.log("Getting WebGL context for canvas:", canvas);
    let gl = canvas.getContext("webgl2", params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) {
      console.log("WebGL2 not available, trying WebGL1");
      gl =
        canvas.getContext("webgl", params) ||
        canvas.getContext("experimental-webgl", params);
    }
    // console.log("WebGL context obtained:", gl);
    // console.log("WebGL version:", isWebGL2 ? "2" : "1");

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension("EXT_color_buffer_float");
      supportLinearFiltering = gl.getExtension("OES_texture_float_linear");
    } else {
      halfFloat = gl.getExtension("OES_texture_half_float");
      supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear");
    }

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const halfFloatTexType = isWebGL2
      ? gl.HALF_FLOAT
      : halfFloat && halfFloat.HALF_FLOAT_OES;

    let formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = this._getSupportedFormat(
        gl,
        gl.RGBA16F,
        gl.RGBA,
        halfFloatTexType
      );
      formatRG = this._getSupportedFormat(
        gl,
        gl.RG16F,
        gl.RG,
        halfFloatTexType
      );
      formatR = this._getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      // fallback formats for WebGL1
      formatRGBA = this._getSupportedFormat(
        gl,
        gl.RGBA,
        gl.RGBA,
        halfFloatTexType
      );
      formatRG = this._getSupportedFormat(
        gl,
        gl.RGBA,
        gl.RGBA,
        halfFloatTexType
      );
      formatR = this._getSupportedFormat(
        gl,
        gl.RGBA,
        gl.RGBA,
        halfFloatTexType
      );
    }

    return {
      gl,
      ext: {
        formatRGBA,
        formatRG,
        formatR,
        halfFloatTexType,
        supportLinearFiltering,
      },
    };
  }

  _getSupportedFormat(gl, internalFormat, format, type) {
    if (!this._supportRenderTextureFormat(gl, internalFormat, format, type)) {
      switch (internalFormat) {
        case gl.R16F:
          return this._getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        case gl.RG16F:
          return this._getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        default:
          return null;
      }
    }
    return { internalFormat, format };
  }

  _supportRenderTextureFormat(gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      4,
      4,
      0,
      format,
      type,
      null
    );
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status === gl.FRAMEBUFFER_COMPLETE;
  }

  _compileShader(type, source, keywords) {
    source = this._addKeywords(source, keywords);
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error(this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  _addKeywords(source, keywords) {
    if (!keywords || !keywords.length) return source;
    let s = "";
    keywords.forEach((k) => {
      s += `#define ${k}\n`;
    });
    return s + source;
  }

  _createProgram(vs, fs) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);

    // ensure attribute 0 is aPosition
    this.gl.bindAttribLocation(program, 0, "aPosition");

    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error(this.gl.getProgramInfoLog(program));
    }
    return program;
  }

  _getUniforms(program) {
    const uniforms = {};
    const n = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = this.gl.getActiveUniform(program, i);
      uniforms[info.name] = this.gl.getUniformLocation(program, info.name);
    }
    return uniforms;
  }

  _initShaders() {
    const baseVertexShader = this._compileShader(
      this.gl.VERTEX_SHADER,
      `
          precision highp float;
          attribute vec2 aPosition;
          varying vec2 vUv;
          varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;
          uniform vec2 texelSize;
          void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
          }
        `
    );

    const copyShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv;
          uniform sampler2D uTexture;
          void main () {
            vec3 rgb = texture2D(uTexture, vUv).rgb;
            // Alpha = brightness; black => alpha 0, bright dye => alpha ~1
            float a = clamp(max(max(rgb.r, rgb.g), rgb.b), 0.0, 1.0);
            gl_FragColor = vec4(rgb, a);
          }
        `
    );

    const clearShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv;
          uniform sampler2D uTexture; uniform float value;
          void main () { gl_FragColor = value * texture2D(uTexture, vUv); }
        `
    );

    const splatShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision highp float; precision highp sampler2D;
          varying vec2 vUv;
          uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;
          uniform vec2 point; uniform float radius;
          void main () {
            vec2 p = vUv - point.xy; p.x *= aspectRatio;
            vec3 splat = exp(-dot(p,p)/radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
          }
        `
    );

    const advectionShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision highp float; precision highp sampler2D;
          varying vec2 vUv;
          uniform sampler2D uVelocity; uniform sampler2D uSource;
          uniform vec2 texelSize; uniform vec2 dyeTexelSize;
          uniform float dt; uniform float dissipation;
    
          vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
            vec2 st = uv / tsize - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);
            vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
            vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
            vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
            vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
            return mix(mix(a,b,fuv.x), mix(c,d,fuv.x), fuv.y);
          }
    
          void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    #ifdef MANUAL_FILTERING
            vec4 result = bilerp(uSource, coord, dyeTexelSize);
    #else
            vec4 result = texture2D(uSource, coord);
    #endif
            float decay = 1.0 + dissipation * dt;
            gl_FragColor = result / decay;
          }
        `,
      this.ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]
    );

    const divergenceShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
            if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
          }
        `
    );

    const curlShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B; gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
          }
        `
    );

    const vorticityShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision highp float; precision highp sampler2D;
          varying vec2 vUv, vL, vR, vT, vB;
          uniform sampler2D uVelocity; uniform sampler2D uCurl;
          uniform float curl; uniform float dt;
          void main () {
            float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;
            vec2 vel = texture2D(uVelocity, vUv).xy; vel += force * dt;
            vel = clamp(vel, vec2(-1000.0), vec2(1000.0)); gl_FragColor = vec4(vel, 0.0, 1.0);
          }
        `
    );

    const pressureShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv, vL, vR, vT, vB; uniform sampler2D uPressure; uniform sampler2D uDivergence;
          void main () {
            float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25; gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
          }
        `
    );

    const gradientSubtractShader = this._compileShader(
      this.gl.FRAGMENT_SHADER,
      `
          precision mediump float; precision mediump sampler2D;
          varying highp vec2 vUv, vL, vR, vT, vB; uniform sampler2D uPressure; uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;
            vec2 vel = texture2D(uVelocity, vUv).xy; vel -= vec2(R - L, T - B);
            gl_FragColor = vec4(vel, 0.0, 1.0);
          }
        `
    );

    // create programs + uniform caches
    const mk = (fs) => ({
      program: this._createProgram(baseVertexShader, fs),
      uniforms: null,
      bind: function (gl) {
        gl.useProgram(this.program);
      },
    });

    this.copyProgram = mk(copyShader);
    this.copyProgram.uniforms = this._getUniforms(this.copyProgram.program);
    this.clearProgram = mk(clearShader);
    this.clearProgram.uniforms = this._getUniforms(this.clearProgram.program);
    this.splatProgram = mk(splatShader);
    this.splatProgram.uniforms = this._getUniforms(this.splatProgram.program);
    this.advectionProgram = mk(advectionShader);
    this.advectionProgram.uniforms = this._getUniforms(
      this.advectionProgram.program
    );
    this.divergenceProgram = mk(divergenceShader);
    this.divergenceProgram.uniforms = this._getUniforms(
      this.divergenceProgram.program
    );
    this.curlProgram = mk(curlShader);
    this.curlProgram.uniforms = this._getUniforms(this.curlProgram.program);
    this.vorticityProgram = mk(vorticityShader);
    this.vorticityProgram.uniforms = this._getUniforms(
      this.vorticityProgram.program
    );
    this.pressureProgram = mk(pressureShader);
    this.pressureProgram.uniforms = this._getUniforms(
      this.pressureProgram.program
    );
    this.gradientSubtractProgram = mk(gradientSubtractShader);
    this.gradientSubtractProgram.uniforms = this._getUniforms(
      this.gradientSubtractProgram.program
    );
  }

  _initBlit() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array([0, 1, 2, 0, 2, 3]),
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    this.blit = (target, clear = false) => {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        clear = false; // keep underlying page visible
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  }

  _createFBO(w, h, internalFormat, format, type, param) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      w,
      h,
      0,
      format,
      type,
      null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const texelSizeX = 1.0 / w;
    const texelSizeY = 1.0 / h;
    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX,
      texelSizeY,
      attach: (id) => {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  _createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = this._createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = this._createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() {
        return fbo1;
      },
      set read(v) {
        fbo1 = v;
      },
      get write() {
        return fbo2;
      },
      set write(v) {
        fbo2 = v;
      },
      swap() {
        const t = fbo1;
        fbo1 = fbo2;
        fbo2 = t;
      },
    };
  }

  _initFramebuffers() {
    const simRes = this._getResolution(this.config.SIM_RESOLUTION);
    const dyeRes = this._getResolution(this.config.DYE_RESOLUTION);
    const texType = this.ext.halfFloatTexType;
    const rgba = this.ext.formatRGBA,
      rg = this.ext.formatRG,
      r = this.ext.formatR;
    const filtering = this.ext.supportLinearFiltering
      ? this.gl.LINEAR
      : this.gl.NEAREST;

    this.gl.disable(this.gl.BLEND);

    if (!this.dye)
      this.dye = this._createDoubleFBO(
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      );
    else
      this.dye = this._resizeDoubleFBO(
        this.dye,
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      );

    if (!this.velocity)
      this.velocity = this._createDoubleFBO(
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering
      );
    else
      this.velocity = this._resizeDoubleFBO(
        this.velocity,
        simRes.width,
        simRes.height,
        rg.internalFormat,
        rg.format,
        texType,
        filtering
      );

    this.divergence = this._createFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      this.gl.NEAREST
    );
    this.curl = this._createFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      this.gl.NEAREST
    );
    this.pressure = this._createDoubleFBO(
      simRes.width,
      simRes.height,
      r.internalFormat,
      r.format,
      texType,
      this.gl.NEAREST
    );
  }

  _resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
    if (target.width === w && target.height === h) return target;
    target.read = this._resizeFBO(
      target.read,
      w,
      h,
      internalFormat,
      format,
      type,
      param
    );
    target.write = this._createFBO(w, h, internalFormat, format, type, param);
    target.width = w;
    target.height = h;
    target.texelSizeX = 1.0 / w;
    target.texelSizeY = 1.0 / h;
    return target;
  }

  _resizeFBO(target, w, h, internalFormat, format, type, param) {
    const newFBO = this._createFBO(w, h, internalFormat, format, type, param);
    this.copyProgram.bind(this.gl);
    this.gl.uniform1i(this.copyProgram.uniforms.uTexture, target.attach(0));
    this.blit(newFBO);
    return newFBO;
  }

  // === Frame loop ==========================================================

  _updateFrame() {
    const dt = this._calcDeltaTime();
    if (this.resizeCanvas()) this._initFramebuffers();
    this._updateColors(dt);
    this._applyInputs();
    this._step(dt);
    this._render(null);
    this.animationId = requestAnimationFrame(() => this._updateFrame());
  }

  _calcDeltaTime() {
    const now = Date.now();
    let dt = (now - this.lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666); // ~60fps clamp
    this.lastUpdateTime = now;
    return dt;
  }

  resizeCanvas() {
    // Check if we're in an iframe and size accordingly
    const iframe = window.frameElement;
    let w, h;
    
    if (iframe) {
      // Size to iframe dimensions
      const iframeRect = iframe.getBoundingClientRect();
      w = this._scaleByPixelRatio(iframeRect.width);
      h = this._scaleByPixelRatio(iframeRect.height);
    } else {
      // Fallback to window dimensions
      w = this._scaleByPixelRatio(window.innerWidth);
      h = this._scaleByPixelRatio(window.innerHeight);
    }
    
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      return true;
    }
    return false;
  }

  _updateColors(dt) {
    this.colorUpdateTimer += dt * this.config.COLOR_UPDATE_SPEED;
    if (this.colorUpdateTimer >= 1) {
      this.colorUpdateTimer = this._wrap(this.colorUpdateTimer, 0, 1);
      this.pointers.forEach((p) => (p.color = this._generateColor()));
    }
  }

  _applyInputs() {
    this.pointers.forEach((p) => {
      if (p.moved) {
        p.moved = false;
        this._splatPointer(p);
      }
    });
  }

  _step(dt) {
    const gl = this.gl;
    gl.disable(gl.BLEND);

    // curl
    gl.useProgram(this.curlProgram.program);
    gl.uniform2f(
      this.curlProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    gl.uniform1i(
      this.curlProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    this.blit(this.curl);

    // vorticity
    gl.useProgram(this.vorticityProgram.program);
    gl.uniform2f(
      this.vorticityProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    gl.uniform1i(
      this.vorticityProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    gl.uniform1i(this.vorticityProgram.uniforms.uCurl, this.curl.attach(1));
    gl.uniform1f(this.vorticityProgram.uniforms.curl, this.config.CURL);
    gl.uniform1f(this.vorticityProgram.uniforms.dt, dt);
    this.blit(this.velocity.write);
    this.velocity.swap();

    // divergence
    gl.useProgram(this.divergenceProgram.program);
    gl.uniform2f(
      this.divergenceProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    gl.uniform1i(
      this.divergenceProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    this.blit(this.divergence);

    // clear pressure
    gl.useProgram(this.clearProgram.program);
    gl.uniform1i(
      this.clearProgram.uniforms.uTexture,
      this.pressure.read.attach(0)
    );
    gl.uniform1f(this.clearProgram.uniforms.value, this.config.PRESSURE);
    this.blit(this.pressure.write);
    this.pressure.swap();

    // pressure solve
    gl.useProgram(this.pressureProgram.program);
    gl.uniform2f(
      this.pressureProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    gl.uniform1i(
      this.pressureProgram.uniforms.uDivergence,
      this.divergence.attach(0)
    );
    for (let i = 0; i < this.config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(
        this.pressureProgram.uniforms.uPressure,
        this.pressure.read.attach(1)
      );
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    // gradient subtract
    gl.useProgram(this.gradientSubtractProgram.program);
    gl.uniform2f(
      this.gradientSubtractProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    gl.uniform1i(
      this.gradientSubtractProgram.uniforms.uPressure,
      this.pressure.read.attach(0)
    );
    gl.uniform1i(
      this.gradientSubtractProgram.uniforms.uVelocity,
      this.velocity.read.attach(1)
    );
    this.blit(this.velocity.write);
    this.velocity.swap();

    // advection (velocity)
    gl.useProgram(this.advectionProgram.program);
    gl.uniform2f(
      this.advectionProgram.uniforms.texelSize,
      this.velocity.texelSizeX,
      this.velocity.texelSizeY
    );
    if (!this.ext.supportLinearFiltering)
      gl.uniform2f(
        this.advectionProgram.uniforms.dyeTexelSize,
        this.velocity.texelSizeX,
        this.velocity.texelSizeY
      );
    let velocityId = this.velocity.read.attach(0);
    gl.uniform1i(this.advectionProgram.uniforms.uVelocity, velocityId);
    gl.uniform1i(this.advectionProgram.uniforms.uSource, velocityId);
    gl.uniform1f(this.advectionProgram.uniforms.dt, dt);
    gl.uniform1f(
      this.advectionProgram.uniforms.dissipation,
      this.config.VELOCITY_DISSIPATION
    );
    this.blit(this.velocity.write);
    this.velocity.swap();

    // advection (dye)
    if (!this.ext.supportLinearFiltering)
      gl.uniform2f(
        this.advectionProgram.uniforms.dyeTexelSize,
        this.dye.texelSizeX,
        this.dye.texelSizeY
      );
    gl.uniform1i(
      this.advectionProgram.uniforms.uVelocity,
      this.velocity.read.attach(0)
    );
    gl.uniform1i(
      this.advectionProgram.uniforms.uSource,
      this.dye.read.attach(1)
    );
    gl.uniform1f(
      this.advectionProgram.uniforms.dissipation,
      this.config.DENSITY_DISSIPATION
    );
    this.blit(this.dye.write);
    this.dye.swap();
  }

  _render(target) {
    const gl = this.gl;
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    // display dye
    this.copyProgram.bind(gl);
    gl.uniform1i(this.copyProgram.uniforms.uTexture, this.dye.read.attach(0));
    this.blit(target);
  }

  // === Splatting & pointer helpers ========================================

  _splatPointer(pointer) {
    const dx = pointer.deltaX * this.config.SPLAT_FORCE;
    const dy = pointer.deltaY * this.config.SPLAT_FORCE;
    this._splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
  }

  _splat(x, y, dx, dy, color) {
    const gl = this.gl;
    // velocity
    gl.useProgram(this.splatProgram.program);
    gl.uniform1i(
      this.splatProgram.uniforms.uTarget,
      this.velocity.read.attach(0)
    );
    gl.uniform1f(
      this.splatProgram.uniforms.aspectRatio,
      this.canvas.width / this.canvas.height
    );
    gl.uniform2f(this.splatProgram.uniforms.point, x, y);
    gl.uniform3f(this.splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(
      this.splatProgram.uniforms.radius,
      this._correctRadius(this.config.SPLAT_RADIUS / 100.0)
    );
    this.blit(this.velocity.write);
    this.velocity.swap();

    // dye
    gl.uniform1i(this.splatProgram.uniforms.uTarget, this.dye.read.attach(0));
    gl.uniform3f(
      this.splatProgram.uniforms.color,
      color[0],
      color[1],
      color[2]
    );
    this.blit(this.dye.write);
    this.dye.swap();
  }

  _createPointer(type, id) {
    return {
      id: id,
      texcoordX: 0,
      texcoordY: 0,
      prevTexcoordX: 0,
      prevTexcoordY: 0,
      deltaX: 0,
      deltaY: 0,
      down: false,
      moved: false,
      color: null,
      type: type,
    };
  }

  _updatePointerDownData(pointer, id, posX, posY) {
    pointer.id = id;
    pointer.down = true;
    pointer.moved = false;
    pointer.texcoordX = posX / this.canvas.width;
    pointer.texcoordY = 1.0 - posY / this.canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = this._generateColor();
  }

  _updatePointerMoveData(pointer, posX, posY, color) {
    // Safety check - ensure canvas exists
    if (!this.canvas) {
      console.warn("Canvas is null in _updatePointerMoveData, skipping update");
      return;
    }
    
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / this.canvas.width;
    pointer.texcoordY = 1.0 - posY / this.canvas.height;
    pointer.deltaX = this._correctDeltaX(
      pointer.texcoordX - pointer.prevTexcoordX
    );
    pointer.deltaY = this._correctDeltaY(
      pointer.texcoordY - pointer.prevTexcoordY
    );
    
    // Only update moved flag if it's not already set to true
    // This preserves the moved flag set by InputManager
    if (!pointer.moved) {
      pointer.moved = Math.abs(pointer.deltaX) > 0.0 || Math.abs(pointer.deltaY) > 0.0;
    }
    // pointer.color = color;
    pointer.color = color || pointer.color || this._generateColor();
  }

  _updatePointerUpData(pointer) {
    pointer.down = false;
  }

  _clickSplat(pointer) {
    const color = this._generateColor();
    color[0] *= 10.0;
    color[1] *= 10.0;
    color[2] *= 10.0;
    const dx = 10 * (Math.random() - 0.5);
    const dy = 30 * (Math.random() - 0.5);
    this._splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
  }

  _correctRadius(radius) {
    const aspect = this.canvas.width / this.canvas.height;
    if (aspect > 1) radius *= aspect;
    return radius;
  }

  _correctDeltaX(d) {
    const a = this.canvas.width / this.canvas.height;
    if (a < 1) d *= a;
    return d;
  }
  _correctDeltaY(d) {
    const a = this.canvas.width / this.canvas.height;
    if (a > 1) d /= a;
    return d;
  }

  _generateColor() {
    const c = this._HSVtoRGB(Math.random(), 1.0, 1.0);
    return [c.r * 0.12, c.g * 0.12, c.b * 0.12];
  }

  _HSVtoRGB(h, s, v) {
    let r,
      g,
      b,
      i = Math.floor(h * 6),
      f = h * 6 - i;
    const p = v * (1 - s),
      q = v * (1 - f * s),
      t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      default:
        r = v;
        g = p;
        b = q;
    }
    return { r, g, b };
  }

  _wrap(value, min, max) {
    const range = max - min;
    if (range === 0) return min;
    return ((value - min) % range) + min;
  }

  _getResolution(resolution) {
    let aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1.0 / aspect;
    const min = Math.round(resolution),
      max = Math.round(resolution * aspect);
    return this.gl.drawingBufferWidth > this.gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  _scaleByPixelRatio(v) {
    const pr = window.devicePixelRatio || 1;
    return Math.floor(v * pr);
  }

  // ----- Pointer helpers -----
  _pointerKey(id = "default") {
    return `mouse:${id}`;
  }

  _registerPointer(id = "default", color = null) {
    const key = this._pointerKey(id);
    if (this.pointerMap.has(key)) return this.pointerMap.get(key);
    const p = this._createPointer("mouse", id);
    if (Array.isArray(color)) p.color = color;
    this.pointers.push(p);
    this.pointerMap.set(key, p);
    return p;
  }

  _getOrCreatePointer(id = "default", color = null) {
    const key = this._pointerKey(id);
    return this.pointerMap.get(key) ?? this._registerPointer(id, color);
  }

  _removePointer(id = "default") {
    const key = this._pointerKey(id);
    const p = this.pointerMap.get(key);
    if (!p) return false;
    this.pointerMap.delete(key);
    this.pointers = this.pointers.filter((x) => x !== p);
    return true;
  }

  // Public API
  // add in WebGLFluidCursor public API
  addPointer(id = "default", color = null) {
    return this._registerPointer(id, color);
  }
  removePointer(id = "default") {
    return this._removePointer(id);
  }
  updatePointer(id, x, y, color = null) {
    this.inputManager.updatePointerPosition(x, y, color, id);
  }
  onEyeGazeMoveFor(id, x, y, color = null) {
    this.inputManager.updatePointerPosition(x, y, color, id);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebGLFluidCursor;
}

if (typeof window !== 'undefined') {
  window.WebGLFluidCursor = WebGLFluidCursor;
}

// ES6 module export
export default WebGLFluidCursor;
export { WebGLFluidCursor };
