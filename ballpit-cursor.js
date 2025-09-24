/* ballpit-cursor.js
   Transparent, pointer-events:none THREE.js "ballpit" cursor overlay (vanilla JS)
   - Same external API shape as fluid-cursor.js:
       new WebGLBallpitCursor({ configOverrides, autoMouseEvents })
       .inputManager.updatePointerPosition(x, y, color?, id?)
   - No bundler required. Dynamically imports THREE module from CDN.
*/
(() => {
    // Dynamically import THREE as an ES module even though *this* file is a classic script.
    const threeCdn = "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js";
  
    // InputManager is now loaded from external script
  
    class WebGLBallpitCursor {
      constructor({ configOverrides = {}, autoMouseEvents = false } = {}) {
        this.THREE = null; // filled after import
        this.ready = false;
  
        // Public API - InputManager handles all pointer logic
        this.inputManager = new InputManager(this, {
          cursorType: 'ballpit',
          useBallAssignment: true,
          inactiveTimeout: 5000
        });

        // Default config (can be overridden)
        this.config = Object.assign(
          {
            COUNT: 50,
            MIN_SIZE: 0.6,
            MAX_SIZE: 1.2,
            GRAVITY: 0.02,
            FRICTION: 0.998,
            WALL_BOUNCE: 0.95,
            MAX_VEL: 0.2,
            FOLLOW_CURSOR: true,
            LIGHT_INTENSITY: 750,
            AMBIENT_COLOR: 0xffffff,
            AMBIENT_INTENSITY: 1.05,
            LEADER_EASE: 0.3,
            PAUSED: false,
            // vibrant colorful palette with white balls
            PALETTE: [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43, 0xee5a24, 0x0abde3, 0x006ba6, 0x8338ec, 0x3a86ff, 0xffffff, 0xf8f9fa, 0xe9ecef, 0xffffff]
          },
          configOverrides || {}
        );
  
        // Canvas overlay
        this.canvas = document.createElement("canvas");
        Object.assign(this.canvas.style, {
          position: "fixed",
          inset: "0",
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: "9998",
          background: "transparent"
        });
        document.body.appendChild(this.canvas);
  
        // Lifecycle bindings
        this._onResize = this._debounce(() => this._resize(), 100);
        this._onVisibility = () => (document.hidden ? cancelAnimationFrame(this._raf) : this._loop());
        this._autoMouse = autoMouseEvents;
  
        // Boot
        this._init().catch((err) => {
          console.error("[Ballpit] failed to init:", err);
        });
      }
  
      // ---------- Public helpers (optional parity with fluid cursor) ----------
      pause() {
        this.config.PAUSED = true;
      }
      play() {
        this.config.PAUSED = false;
      }
      destroy() {
        cancelAnimationFrame(this._raf);
        window.removeEventListener("resize", this._onResize);
        document.removeEventListener("visibilitychange", this._onVisibility);
        if (this._autoMouse) {
          window.removeEventListener("mousemove", this._autoMouseMove);
          window.removeEventListener("mouseleave", this._autoMouseLeave);
        }
  
        if (this.scene) {
          this.scene.traverse((o) => {
            if (o.isMesh) {
              o.geometry?.dispose?.();
              if (Array.isArray(o.material)) o.material.forEach((m) => m?.dispose?.());
              else o.material?.dispose?.();
            }
          });
        }
        this.renderer?.dispose?.();
        this.canvas?.remove?.();
  
        this.ready = false;
      }
  
      // ---------- Core init ----------
      async _init() {
        // Load THREE
        this.THREE = await import(threeCdn);
  
        // Renderer / Scene / Camera
        this.renderer = new this.THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  
        this.scene = new this.THREE.Scene();
  
        this.camera = new this.THREE.PerspectiveCamera(45, 1, 0.1, 100);
        this.camera.position.set(0, 0, 20);
        this.camera.lookAt(0, 0, 0);
  
        // Lights
        this.ambient = new this.THREE.AmbientLight(
          this.config.AMBIENT_COLOR,
          this.config.AMBIENT_INTENSITY
        );
        this.scene.add(this.ambient);
  
        this.keyLight = new this.THREE.PointLight(this.config.PALETTE[0], this.config.LIGHT_INTENSITY);
        this.keyLight.position.set(0, 0, 5);
        this.scene.add(this.keyLight);

        // Add a second light at top left
        this.topLeftLight = new this.THREE.PointLight(this.config.PALETTE[2], this.config.LIGHT_INTENSITY * 2.0);
        this.topLeftLight.position.set(-8, 8, 10);
        this.scene.add(this.topLeftLight);
  
        // Bounds (updated by _resize based on FOV)
        this.bounds = { x: 5, y: 5, z: 2 };
  
        // Physics buffers
        const C = this.config.COUNT;
        this.positions = new Float32Array(3 * C);
        this.velocities = new Float32Array(3 * C);
        this.sizes = new Float32Array(C);
        this.center = new this.THREE.Vector3(0, 0, 0);
  
        // Seed particles
        for (let i = 0; i < C; i++) {
          const b = 3 * i;
          this.positions[b + 0] = this.THREE.MathUtils.randFloatSpread(2 * this.bounds.x);
          this.positions[b + 1] = this.THREE.MathUtils.randFloatSpread(2 * this.bounds.y);
          this.positions[b + 2] = this.THREE.MathUtils.randFloatSpread(2 * this.bounds.z);
          this.velocities[b + 0] = this.THREE.MathUtils.randFloatSpread(0.2);
          this.velocities[b + 1] = this.THREE.MathUtils.randFloatSpread(0.2);
          this.velocities[b + 2] = this.THREE.MathUtils.randFloatSpread(0.2);
          this.sizes[i] =
            i === 0 && this.config.FOLLOW_CURSOR
              ? Math.max(this.config.MAX_SIZE, 0.36)
              : this.THREE.MathUtils.randFloat(this.config.MIN_SIZE, this.config.MAX_SIZE);
        }
  
        // Instanced spheres
        const geom = new this.THREE.SphereGeometry(1, 24, 24);
        const mat = new this.THREE.MeshPhysicalMaterial({
          metalness: 0.8,
          roughness: 0.1,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05
        });
  
        this.mesh = new this.THREE.InstancedMesh(geom, mat, C);
        this.mesh.instanceMatrix.setUsage(this.THREE.DynamicDrawUsage);
        console.log('Created InstancedMesh with count:', C, 'Total instances:', this.mesh.count);
        // Color gradient across instances
        const palette = this.config.PALETTE.map((h) => new this.THREE.Color(h));
        const lerpColor = (t) => {
          const x = this.THREE.MathUtils.clamp(t, 0, 1) * (palette.length - 1);
          const i = Math.floor(x);
          if (i >= palette.length - 1) return palette[i].clone();
          const a = x - i;
          return palette[i].clone().lerp(palette[i + 1], a);
        };
        for (let i = 0; i < C; i++) {
          this.mesh.setColorAt(i, lerpColor(i / (C - 1)));
        }
        this.scene.add(this.mesh);
  
        // Reusable xform
        this._tmpObj = new this.THREE.Object3D();
  
        // Ray setup (project pointer onto z=0 plane in camera space)
        this.raycaster = new this.THREE.Raycaster();
        this.mouseNdc = new this.THREE.Vector2(-10, -10);
        this.followPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 0, 1), 0);
        this.planeHit = new this.THREE.Vector3();
  
        // Auto mouse (optional parity with fluid cursor)
        if (this._autoMouse) {
          this._autoMouseMove = (e) => {
            this.inputManager.updatePointerPosition(e.clientX, e.clientY, null, "mouse");
          };
          this._autoMouseLeave = () => {
            // ease back to origin if following
            if (this.config.FOLLOW_CURSOR) this.center.set(0, 0, 0);
          };
          window.addEventListener("mousemove", this._autoMouseMove, { passive: true });
          window.addEventListener("mouseleave", this._autoMouseLeave, { passive: true });
        }
  
        // Events
        window.addEventListener("resize", this._onResize);
        document.addEventListener("visibilitychange", this._onVisibility);
  
        // Start
        this._resize();
        this._lastT = performance.now();
        this.ready = true;
        this._loop();
      }
  
      // ---------- Input plumbing ----------
      _onPointerInputChanged() {
        // Use InputManager's target pointer logic
        const targetPointer = this.inputManager.getTargetPointer();
        
        if (!targetPointer || !this.ready) return;

        // Project target coords into world plane
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.mouseNdc.set((targetPointer.x / w) * 2 - 1, -(targetPointer.y / h) * 2 + 1);
        this.raycaster.setFromCamera(this.mouseNdc, this.camera);
        this.camera.getWorldDirection(this.followPlane.normal);
        if (this.raycaster.ray.intersectPlane(this.followPlane, this.planeHit)) {
          this.center.copy(this.planeHit);
        }
      }
  
      // ---------- Frame loop ----------
      _loop() {
        this._raf = requestAnimationFrame(() => this._loop());
        if (!this.ready) return;
  
        const now = performance.now();
        let dt = (now - this._lastT) / 1000;
        this._lastT = now;
        dt = Math.min(dt, 1 / 60);
  
        if (!this.config.PAUSED) this._stepPhysics(dt);
        this._render();
        
        // Cleanup inactive users every 2 seconds
        if (now % 2000 < dt * 1000) {
          this.inputManager.cleanupInactiveUsers(5000); // 5 second timeout
        }
      }
  
      // ---------- Physics ----------
      _stepPhysics(dt) {
        const {
          COUNT, GRAVITY, FRICTION, WALL_BOUNCE, MAX_VEL, FOLLOW_CURSOR, LEADER_EASE
        } = this.config;
  
        const bx = this.bounds.x, by = this.bounds.y, bz = Math.max(this.bounds.z, this.config.MAX_SIZE || 1);
        const p = this.positions, v = this.velocities, s = this.sizes;
  
        // --- cursor balls: kinematic control
        if (FOLLOW_CURSOR) {
          // Mouse cursor ball (index 0)
          p[0] += (this.center.x - p[0]) * LEADER_EASE;
          p[1] += (this.center.y - p[1]) * LEADER_EASE;
          p[2] += (0 - p[2]) * LEADER_EASE;
          v[0] = v[1] = v[2] = 0;
          this.keyLight.position.set(p[0], p[1], 5);
          s[0] = Math.max(this.config.MAX_SIZE, 0.36);
          
          // Multiple eyegaze cursor balls - each user gets their own ball
          for (const [userType, ballIndex] of this.inputManager.getEyegazeBallIndices()) {
            if (this.inputManager.hasPointer(userType)) {
              const eyegazePointer = this.inputManager.getPointer(userType);
              if (eyegazePointer) {
                const w = window.innerWidth;
                const h = window.innerHeight;
                const eyegazeNdc = new this.THREE.Vector2((eyegazePointer.x / w) * 2 - 1, -(eyegazePointer.y / h) * 2 + 1);
                const eyegazeRaycaster = new this.THREE.Raycaster();
                eyegazeRaycaster.setFromCamera(eyegazeNdc, this.camera);
                const eyegazeHit = new this.THREE.Vector3();
                this.camera.getWorldDirection(this.followPlane.normal);
                if (eyegazeRaycaster.ray.intersectPlane(this.followPlane, eyegazeHit)) {
                  const ei = 3 * ballIndex;
                  p[ei] += (eyegazeHit.x - p[ei]) * LEADER_EASE;
                  p[ei + 1] += (eyegazeHit.y - p[ei + 1]) * LEADER_EASE;
                  p[ei + 2] += (0 - p[ei + 2]) * LEADER_EASE;
                  v[ei] = v[ei + 1] = v[ei + 2] = 0;
                  s[ballIndex] = Math.max(this.config.MAX_SIZE, 0.36);
                }
              }
            } else {
              // Hide eyegaze ball when this user type is not active
              s[ballIndex] = 0;
            }
          }
        } else {
          s[0] = 0;
          // Hide all eyegaze balls
          for (const ballIndex of this.inputManager.getEyegazeBallIndices().values()) {
            s[ballIndex] = 0;
          }
        }

        // --- pairwise collisions: ONLY followers (skip all cursor balls)
        const cursorBallIndices = new Set([0]); // Mouse cursor
        for (const ballIndex of this.inputManager.getEyegazeBallIndices().values()) {
          cursorBallIndices.add(ballIndex);
        }
        
        for (let i = 1; i < COUNT; i++) {
          if (cursorBallIndices.has(i)) continue; // Skip cursor balls
          for (let j = i + 1; j < COUNT; j++) {
            if (cursorBallIndices.has(j)) continue; // Skip cursor balls
            const bi = 3 * i, bj = 3 * j;
            const dx = p[bi] - p[bj], dy = p[bi+1] - p[bj+1], dz = p[bi+2] - p[bj+2];
            const dist = Math.hypot(dx, dy, dz);
            const minDist = s[i] + s[j];
            if (dist > 0 && dist < minDist) {
              const overlap = (minDist - dist) * 0.5;
              const nx = dx / dist, ny = dy / dist, nz = dz / dist;
              // positional correction (soft, no heavy impulses)
              p[bi] += nx * overlap; p[bi+1] += ny * overlap; p[bi+2] += nz * overlap;
              p[bj] -= nx * overlap; p[bj+1] -= ny * overlap; p[bj+2] -= nz * overlap;

              // very gentle velocity separation to reduce sticky clumps
              const push = 0.02; // small!
              v[bi] += nx * push; v[bi+1] += ny * push; v[bi+2] += nz * push;
              v[bj] -= nx * push; v[bj+1] -= ny * push; v[bj+2] -= nz * push;
            }
          }
        }

        // --- special cursor repulsion pass (one-sided) for all cursor balls
        if (FOLLOW_CURSOR) {
          // Apply repulsion for all cursor balls (mouse + eyegaze)
          for (const ballIndex of cursorBallIndices) {
            const cx = p[3 * ballIndex], cy = p[3 * ballIndex + 1], cz = p[3 * ballIndex + 2];
            const cr = s[ballIndex];
            if (cr > 0) { // Only if this cursor ball is active
              for (let i = 1; i < COUNT; i++) {
                if (cursorBallIndices.has(i)) continue; // Skip other cursor balls
                const b = 3 * i;
                const dx = p[b] - cx, dy = p[b+1] - cy, dz = p[b+2] - cz;
                const dist = Math.hypot(dx, dy, dz);
                const minDist = cr + s[i];
                if (dist > 0 && dist < minDist) {
                  const overlap = (minDist - dist);
                  const nx = dx / dist, ny = dy / dist, nz = dz / dist;

                  const sep = overlap * 0.9;
                  p[b] += nx * sep; p[b+1] += ny * sep; p[b+2] += nz * sep;

                  const speed = Math.hypot(v[b], v[b+1], v[b+2]) || 1;
                  const kick = 0.15 * speed + 0.2;
                  v[b] += nx * kick; v[b+1] += ny * kick; v[b+2] += nz * kick;
                }
              }
            }
          }
        }

        for (let i = 1; i < COUNT; i++) {
          const b = 3 * i;

          // gravity
          v[b + 1] -= GRAVITY * s[i] * dt;

          // friction
          v[b + 0] *= FRICTION;
          v[b + 1] *= FRICTION;
          v[b + 2] *= FRICTION;

          // clamp velocity length
          const len = Math.hypot(v[b + 0], v[b + 1], v[b + 2]);
          if (len > MAX_VEL) {
            const f = MAX_VEL / (len || 1);
            v[b + 0] *= f; v[b + 1] *= f; v[b + 2] *= f;
          }

          // integrate
          p[b + 0] += v[b + 0];
          p[b + 1] += v[b + 1];
          p[b + 2] += v[b + 2];

          // walls
          const rad = s[i];
          if (Math.abs(p[b + 0]) + rad > bx) {
            p[b + 0] = Math.sign(p[b + 0]) * (bx - rad);
            v[b + 0] = -v[b + 0] * WALL_BOUNCE;
          }
          if (p[b + 1] - rad < -by) {
            p[b + 1] = -by + rad;
            v[b + 1] = -v[b + 1] * WALL_BOUNCE;
          }
          // No top wall - balls can move freely upward
          if (Math.abs(p[b + 2]) + rad > bz) {
            p[b + 2] = Math.sign(p[b + 2]) * (bz - rad);
            v[b + 2] = -v[b + 2] * WALL_BOUNCE;
          }
        }
      }
  
      // ---------- Render ----------
      _render() {
        const C = this.config.COUNT;
        const p = this.positions;
        const s = this.sizes;
        
        // Debug: log count occasionally
        if (Math.random() < 0.001) { // Very rarely log
          console.log('Rendering', C, 'spheres, mesh count:', this.mesh.count);
        }
  
        for (let i = 0; i < C; i++) {
          const b = 3 * i;
          this._tmpObj.position.set(p[b + 0], p[b + 1], p[b + 2]);
          this._tmpObj.scale.setScalar(Math.max(s[i], 0));
          this._tmpObj.updateMatrix();
          this.mesh.setMatrixAt(i, this._tmpObj.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
      }
  
      // ---------- Resize ----------
      _resize() {
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
  
        // match canvas backing store to CSS size * pixelRatio
        const bw = Math.floor(cssW * pr);
        const bh = Math.floor(cssH * pr);
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
          this.canvas.width = bw;
          this.canvas.height = bh;
        }
        this.renderer.setSize(cssW, cssH, false);
  
        this.camera.aspect = cssW / cssH;
        this.camera.updateProjectionMatrix();
  
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const wHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.length();
        const wWidth = wHeight * this.camera.aspect;
        this.bounds.x = wWidth / 2;
        this.bounds.y = wHeight / 2;
        this.bounds.z = 2;
      }
  
      // ---------- Utils ----------
      _debounce(fn, ms) {
        let t;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn.apply(this, args), ms);
        };
      }
    }
  
    // Expose constructor on window after THREE loads
    // We attach immediately so app.js can `new WebGLBallpitCursor(...)` right away.
    Object.defineProperty(window, "WebGLBallpitCursor", {
      configurable: true,
      enumerable: false,
      get() {
        return WebGLBallpitCursor;
      }
    });
  })();
  