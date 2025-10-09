/**
 * Unified Cursor System - Main Application Controller
 * 
 * This module provides a unified interface for managing both WebGL-based cursor effects:
 * - Ballpit Cursor: Interactive ball physics simulation
 * - Fluid Cursor: WebGL fluid simulation with mouse interaction
 * 
 * Features:
 * - Seamless switching between cursor types
 * - Unified input handling for both cursors
 * - Integration with SquidlySessionV3 eye gaze system
 * - Keyboard controls for cursor switching
 * - Automatic cleanup and resource management
 * 
 * @author Squidly Team
 * @version 1.0.0
 */

import { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor } from './index.js';
/**
 * Map of cursor type strings to method names for actual switching (called by main app)
 * @constant
 */
const CURSOR_TYPE_METHODS = {
  "cursor-app/ballpit": "_switchToBallpit",
  "cursor-app/fluid": "_switchToFluid",
  "cursor-app/metaballs": "_switchToMetaBalls"
};

firebaseSet("cursor-app/currentType", "cursor-app/ballpit");


/**
 * Global cursor management object
 * Provides unified interface for managing cursor effects and input handling
 * 
 * @namespace cursorApp
 * @type {Object}
 */
window.cursorApp = {
  /** @type {string|null} Current active cursor type ('ballpit', 'fluid', or 'metaballs') */
  currentType: null,
  
  /** @type {WebGLFluidCursor|WebGLBallpitCursor|WebGLMetaBallsCursor|null} Current cursor instance */
  currentCursor: null,
  
  /** @type {boolean} Flag to prevent rapid cursor switching during transitions */
  switching: false,
  
  /** @type {boolean} Flag to prevent message loop when syncing from parent */
  syncingFromParent: false,
  
  /**
   * Set the current cursor type and update UI/attributes
   * 
   * @param {string} type - The cursor type to set ('ballpit', 'fluid', or 'metaballs')
   * @memberof cursorApp
   */
  setAppType: function(type) {
    if (this.currentType !== type) {
      this.currentType = type;
      // Set data attribute on body for app-base-api to observe
      document.body.setAttribute('app-type', type);
      
      // Only send message to parent if we're not syncing (avoid infinite loop)
      if (!this.syncingFromParent) {
        firebaseSet("cursor-app/currentType", type);
        console.log("App type set to:", type, "(message sent to parent)");
      } else {
        console.log("App type set to:", type, "(synced from parent, no message sent)");
      }
    }
  },

  /**
   * Send a cursor switch request to the main app
   * 
   * @param {string} cursorType - The cursor type to request ('cursor-app/ballpit', 'cursor-app/fluid', or 'cursor-app/metaballs')
   * @memberof cursorApp
   */
  requestCursorSwitch: function(cursorType) {
    if (cursorType) {
      // window.parent.postMessage({
      //   mode: "app_type",
      //   type: cursorType
      // }, "*");
      firebaseSet("cursor-app/currentType", cursorType);
      console.log("Requested cursor switch to:", cursorType);
    }
  },

  
  /**
   * Switch to ballpit cursor with interactive ball physics
   * 
   * Creates a new WebGLBallpitCursor instance with default configuration.
   * Uses the unified input system for mouse interaction.
   * 
   * @memberof cursorApp
   * @async
   */
  switchToBallpit: function() {
    // Only send request to main app, don't switch locally
    this.requestCursorSwitch("cursor-app/ballpit");
  },
  
  /**
   * Switch to fluid cursor with WebGL fluid simulation
   * 
   * Creates a new WebGLFluidCursor instance with optimized configuration.
   * Includes an initial splash effect to kickstart the fluid simulation.
   * 
   * @memberof cursorApp
   * @async
   */
  switchToFluid: function() {
    // Only send request to main app, don't switch locally
    this.requestCursorSwitch("cursor-app/fluid");
  },

  /**
   * Switch to metaballs cursor with WebGL metaball simulation
   * 
   * Creates a new WebGLMetaBallsCursor instance with organic blob effects.
   * Features animated metaballs that respond to cursor movement.
   * 
   * @memberof cursorApp
   * @async
   */
  switchToMetaBalls: function() {
    // Only send request to main app, don't switch locally
    this.requestCursorSwitch("cursor-app/metaballs");
  },

  /**
   * Actually switch to ballpit cursor (called only by main app)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToBallpit: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      this.currentCursor = new WebGLBallpitCursor({
        configOverrides: {
          // Using default configuration from ballpit-cursor.js
          // Customize: COUNT, MIN_SIZE, MAX_SIZE, GRAVITY, etc.
        },
        autoMouseEvents: false, // Use unified input system
      });
      // Set app type directly without sending message (we're already syncing from parent)
      this.currentType = "cursor-app/ballpit";
      document.body.setAttribute('app-type', "cursor-app/ballpit");
      this.switching = false;
    });
  },

  /**
   * Actually switch to fluid cursor (called only by main app)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToFluid: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      this.currentCursor = new WebGLFluidCursor({
        configOverrides: {
          SPLAT_RADIUS: 0.2,        // Size of fluid splashes
          SPLAT_FORCE: 6000,        // Force applied by splashes
          COLOR_UPDATE_SPEED: 5,    // Speed of color transitions
          DENSITY_DISSIPATION: 0.5, // How quickly density fades
          VELOCITY_DISSIPATION: 1.5, // How quickly velocity fades
        },
        autoMouseEvents: false, // Use unified input system
        onReady: (fc) => {
          if (fc.splashAtClient) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            fc.splashAtClient(cx, cy, [0.5, 0.5, 0.5], "mouse");
          }
        },
      });
      // Set app type directly without sending message (we're already syncing from parent)
      this.currentType = "cursor-app/fluid";
      document.body.setAttribute('app-type', "cursor-app/fluid");
      this.switching = false;
    });
  },

  /**
   * Actually switch to metaballs cursor (called only by main app)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToMetaBalls: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      this.currentCursor = new WebGLMetaBallsCursor({
        configOverrides: {
          BALL_COUNT: 15,           // Number of animated metaballs
          ANIMATION_SIZE: 30,       // Size of the animation area
          CURSOR_BALL_SIZE: 3,      // Size of cursor metaball
          SPEED: 0.3,               // Animation speed
          CLUMP_FACTOR: 1,          // How tightly balls clump
          HOVER_SMOOTHNESS: 0.05,   // Cursor following smoothness
          COLOR: [1, 1, 1],         // Main color (white)
          CURSOR_COLOR: [1, 1, 1],  // Cursor color (white)
          ENABLE_TRANSPARENCY: true // Enable transparency
        },
        autoMouseEvents: false, // Use unified input system
      });
      // Set app type directly without sending message (we're already syncing from parent)
      this.currentType = "cursor-app/metaballs";
      document.body.setAttribute('app-type', "cursor-app/metaballs");
      this.switching = false;
    });
  },
  
  /**
   * Clean up current cursor instance and free resources
   * 
   * Safely destroys the current cursor and waits for cleanup to complete
   * to prevent resource conflicts during cursor switching.
   * 
   * @memberof cursorApp
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   * @private
   */
  destroyCurrentCursor: function() {
    if (this.currentCursor && this.currentCursor.destroy) {
      this.currentCursor.destroy();
      // Add a small delay to ensure cleanup is complete
      this.currentCursor = null;
      return Promise.resolve();
    }
  },
  
  /**
   * Update pointer position for the current cursor
   * 
   * Unified method that handles pointer updates for both cursor types.
   * Includes safety checks for invalid coordinates and cursor state.
   * 
   * @param {number} x - X coordinate of the pointer
   * @param {number} y - Y coordinate of the pointer
   * @param {Array|string|null} [color=null] - Color for the pointer effect
   * @param {string|null} [userId=null] - User ID for the pointer
   * @memberof cursorApp
   */
  updatePointerPosition: function(x, y, color = null, userId = null) {
    if (!this.currentCursor || !this.currentCursor.inputManager) {
      return;
    }
    
    this.currentCursor.inputManager.updatePointerPosition(x, y, color, userId || "mouse");
  },
  
};

// =============================================================================
// EVENT HANDLERS AND INITIALIZATION
// =============================================================================

/**
 * Initialize the cursor system when DOM is ready
 * Sets up event listeners and starts with ballpit cursor
 */
document.addEventListener("DOMContentLoaded", () => {
  // Initialize with ballpit cursor by default (actual switch, not just request)
  // Add a list of gridicons info, sends to parent app
  window.cursorApp._switchToBallpit();

  // Mouse event handler that works with any cursor type
  document.addEventListener("mousemove", (e) => {
    window.cursorApp.updatePointerPosition(e.clientX, e.clientY, null, "mouse");
  });

  // Listen for messages from SquidlyV3
  firebaseOnValue("cursor-app/currentType", (value) => {
    // Switch to the requested cursor type if different
    if (value !== window.cursorApp.currentType) {
      const methodName = CURSOR_TYPE_METHODS[value];
      if (methodName && typeof window.cursorApp[methodName] === 'function') {
        // Set flag to prevent sending message back to parent
        window.cursorApp.syncingFromParent = true;
        window.cursorApp[methodName]();
        window.cursorApp.syncingFromParent = false;
      } else {
        console.log("Unknown cursor type:", value, "or method not found:", methodName);
      }
    }
  });

  setIcon(1, 0, {
    symbol: "switch",
    displayValue: "Switch Mode",
    type: "action",
  }, (value) => {
    // Cycle through available apps
    const appTypes = Object.keys(CURSOR_TYPE_METHODS);
    const currentIndex = appTypes.indexOf(window.cursorApp.currentType);
    const nextIndex = (currentIndex + 1) % appTypes.length;
    const nextAppType = appTypes[nextIndex];
    
    // Request switch using the requestCursorSwitch method
    window.cursorApp.requestCursorSwitch(nextAppType);
  });



  window.addEventListener("message", (event) => {
    if (!event.data) {
      return;
    }

    // // Handle sync_app_type message from parent
    // if (event.data.mode === "sync_app_type") {
    //   // Switch to the requested cursor type if different
    //   if (event.data.type !== window.cursorApp.currentType) {
    //     const methodName = CURSOR_TYPE_METHODS[event.data.type];
    //     if (methodName && typeof window.cursorApp[methodName] === 'function') {
    //       // Set flag to prevent sending message back to parent
    //       window.cursorApp.syncingFromParent = true;
    //       window.cursorApp[methodName]();
    //       window.cursorApp.syncingFromParent = false;
    //     } else {
    //       console.warn("Unknown cursor type:", event.data.type, "or method not found:", methodName);
    //     }
    //   }
    // }

    // if (event.data.command === "switch_app") {
    //   // Cycle through available apps
    //   const appTypes = Object.keys(CURSOR_TYPE_METHODS);
    //   const currentIndex = appTypes.indexOf(window.cursorApp.currentType);
    //   const nextIndex = (currentIndex + 1) % appTypes.length;
    //   const nextAppType = appTypes[nextIndex];
      
    //   // Request switch using the requestCursorSwitch method
    //   window.cursorApp.requestCursorSwitch(nextAppType);
    // }


    // Safety check for valid coordinates in message
    if (typeof event.data.x === 'number' && typeof event.data.y === 'number') {
      // Handle both cursor types with unified method
      window.cursorApp.updatePointerPosition(
        event.data.x,
        event.data.y,
        null, // Let system generate colors dynamically
        event.data.user || "default"
      );
    }
  });
});