/**
 * ============================================================================
 * Cursor Splash - Main Application Controller (app.js)
 * ============================================================================
 * 
 * This is the main entry point for the Cursor Splash Squidly app. It manages
 * three different WebGL-based cursor effects and handles multi-user synchronization
 * through the Squidly platform.
 * 
 * ARCHITECTURE OVERVIEW:
 * ----------------------
 * 1. Imports three cursor modules (Fluid, Ballpit, MetaBalls)
 * 2. Creates a global cursorApp object for unified cursor management
 * 3. Integrates with Squidly Apps API for multi-user features
 * 4. Handles cursor switching and synchronization via Firebase
 * 5. Listens for cursor updates from all users (mouse + eye gaze)
 * 
 * KEY SQUIDLY API FUNCTIONS USED:
 * --------------------------------
 * - firebaseSet(path, value): Sets a value in Firebase (broadcasts to all users)
 * - firebaseOnValue(path, callback): Listens for Firebase value changes
 * - addCursorListener(callback): Receives cursor positions from all users
 * - setIcon(x, y, options, callback): Creates an interactive grid icon button
 * 
 * CURSOR TYPES AVAILABLE:
 * -----------------------
 * - cursor-app/ballpit: 3D ball physics simulation with THREE.js
 * - cursor-app/fluid: Realistic fluid dynamics with WebGL shaders
 * - cursor-app/metaballs: Organic blob effects with smooth metaball rendering
 * 
 * @author Po-Yao Huang
 * @version 1.0.1
 * @see squidly-apps-api.js for API implementation details
 */

// Import all three cursor effect modules
import { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor } from './index.js';

/**
 * Mapping of cursor type identifiers to internal method names
 * 
 * This map is used to translate Firebase cursor type values (which are shared
 * across all users) to the appropriate internal switching methods. When a user
 * changes the cursor type, the type string is stored in Firebase, and all other
 * users receive that value and look it up in this map to call the correct method.
 * 
 * @constant {Object.<string, string>}
 */
const CURSOR_TYPE_METHODS = {
  "cursor-app/ballpit": "_switchToBallpit",
  "cursor-app/fluid": "_switchToFluid",
  "cursor-app/metaballs": "_switchToMetaBalls"
};

// Initialize the default cursor type in Firebase
// This sets the initial state that all users will see when the app loads
SquidlyAPI.firebaseSet("cursor-app/currentType", "cursor-app/ballpit");


/**
 * ============================================================================
 * Global Cursor Application Manager
 * ============================================================================
 * 
 * This object provides a unified interface for managing all cursor effects in
 * the application. It handles cursor switching, resource management, and
 * multi-user synchronization.
 * 
 * PUBLIC METHODS (for external use):
 * -----------------------------------
 * - switchToBallpit(): Request switch to ballpit cursor
 * - switchToFluid(): Request switch to fluid cursor
 * - switchToMetaBalls(): Request switch to metaballs cursor
 * - updatePointerPosition(x, y, color, userId): Update cursor position
 * 
 * PRIVATE METHODS (called by Squidly framework):
 * -----------------------------------------------
 * - _switchToBallpit(): Actually switch to ballpit (called via Firebase sync)
 * - _switchToFluid(): Actually switch to fluid (called via Firebase sync)
 * - _switchToMetaBalls(): Actually switch to metaballs (called via Firebase sync)
 * - destroyCurrentCursor(): Clean up current cursor before switching
 * - requestCursorSwitch(type): Send cursor switch request to Firebase
 * - setAppType(type): Update current type and sync with parent
 * 
 * HOW IT WORKS:
 * -------------
 * 1. User clicks the grid icon button
 * 2. switchToBallpit/Fluid/MetaBalls() is called
 * 3. This calls requestCursorSwitch() which updates Firebase
 * 4. Firebase sends the update to ALL users (including the one who clicked)
 * 5. firebaseOnValue callback receives the update
 * 6. The callback looks up the method in CURSOR_TYPE_METHODS
 * 7. The _switchToXXX() method is called to actually change the cursor
 * 8. All users now see the same cursor type
 * 
 * @namespace cursorApp
 * @type {Object}
 */
window.cursorApp = {
  // ========================
  // STATE PROPERTIES
  // ========================
  
  /**
   * Current active cursor type identifier
   * @type {string|null}
   * @example "cursor-app/ballpit", "cursor-app/fluid", "cursor-app/metaballs"
   */
  currentType: null,
  
  /**
   * Current cursor instance (one of the three cursor types)
   * @type {WebGLFluidCursor|WebGLBallpitCursor|WebGLMetaBallsCursor|null}
   */
  currentCursor: null,
  
  /**
   * Flag to prevent rapid cursor switching during transitions
   * When true, switch requests are ignored to prevent race conditions
   * @type {boolean}
   */
  switching: false,
  
  /**
   * Flag to prevent infinite message loops when syncing from Firebase
   * Set to true when we're processing a Firebase update to avoid sending
   * another update back to Firebase
   * @type {boolean}
   */
  syncingFromParent: false,
  
  // ========================
  // HELPER METHODS
  // ========================
  
  /**
   * Set the current cursor type and update UI/attributes
   * 
   * This method updates the internal state and the body data attribute.
   * If we're not currently syncing from Firebase, it also broadcasts the
   * change to all other users via firebaseSet.
   * 
   * @param {string} type - The cursor type to set
   * @memberof cursorApp
   */
  setAppType: function(type) {
    if (this.currentType !== type) {
      this.currentType = type;
      // Set data attribute on body for app-base-api to observe
      document.body.setAttribute('app-type', type);
      
      // Only send message to parent if we're not syncing (avoid infinite loop)
      if (!this.syncingFromParent) {
        SquidlyAPI.firebaseSet("cursor-app/currentType", type);
      }
    }
  },

  /**
   * Send a cursor switch request via Firebase
   * 
   * This broadcasts the cursor type to all users in the session. All users
   * (including this one) will receive the update via firebaseOnValue and
   * switch their cursor to match.
   * 
   * @param {string} cursorType - The cursor type identifier (e.g., "cursor-app/ballpit")
   * @memberof cursorApp
   */
  requestCursorSwitch: function(cursorType) {
    if (cursorType) {
      SquidlyAPI.firebaseSet("cursor-app/currentType", cursorType);
    }
  },

  // ========================
  // PUBLIC SWITCH METHODS
  // ========================
  // These methods are called by user interactions (e.g., clicking the icon button)
  // They REQUEST a cursor change by updating Firebase, which then triggers the
  // actual switch via the firebaseOnValue callback
  
  /**
   * PUBLIC: Request switch to ballpit cursor
   * 
   * This method sends a request to switch to the ballpit cursor. It doesn't
   * perform the switch directly - instead it updates Firebase, which then
   * notifies all users (including this one) to switch their cursor.
   * 
   * FLOW: User clicks icon → switchToBallpit() → requestCursorSwitch() →
   *       firebaseSet() → All users receive update → _switchToBallpit()
   * 
   * @memberof cursorApp
   * @public
   */
  switchToBallpit: function() {
    // Only send request via Firebase, don't switch locally
    // The actual switch happens when Firebase broadcasts to everyone
    this.requestCursorSwitch("cursor-app/ballpit");
  },
  
  /**
   * PUBLIC: Request switch to fluid cursor
   * 
   * This method sends a request to switch to the fluid cursor. It doesn't
   * perform the switch directly - instead it updates Firebase, which then
   * notifies all users (including this one) to switch their cursor.
   * 
   * FLOW: User clicks icon → switchToFluid() → requestCursorSwitch() →
   *       firebaseSet() → All users receive update → _switchToFluid()
   * 
   * @memberof cursorApp
   * @public
   */
  switchToFluid: function() {
    // Only send request via Firebase, don't switch locally
    // The actual switch happens when Firebase broadcasts to everyone
    this.requestCursorSwitch("cursor-app/fluid");
  },

  /**
   * PUBLIC: Request switch to metaballs cursor
   * 
   * This method sends a request to switch to the metaballs cursor. It doesn't
   * perform the switch directly - instead it updates Firebase, which then
   * notifies all users (including this one) to switch their cursor.
   * 
   * FLOW: User clicks icon → switchToMetaBalls() → requestCursorSwitch() →
   *       firebaseSet() → All users receive update → _switchToMetaBalls()
   * 
   * @memberof cursorApp
   * @public
   */
  switchToMetaBalls: function() {
    // Only send request via Firebase, don't switch locally
    // The actual switch happens when Firebase broadcasts to everyone
    this.requestCursorSwitch("cursor-app/metaballs");
  },

  // ========================
  // PRIVATE SWITCH METHODS
  // ========================
  // These methods actually perform the cursor switch and are called ONLY by the
  // firebaseOnValue callback when Firebase notifies us of a cursor type change.
  // They should NEVER be called directly by user code.
  
  /**
   * PRIVATE: Actually switch to ballpit cursor
   * 
   * This method performs the actual cursor switch. It's called by the
   * firebaseOnValue callback when ANY user (including this one) changes
   * the cursor type to ballpit.
   * 
   * PROCESS:
   * 1. Check if already switching (prevent race conditions)
   * 2. Destroy the current cursor and clean up resources
   * 3. Create new WebGLBallpitCursor instance
   * 4. Update state variables (but DON'T send to Firebase again)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToBallpit: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      // Create the ballpit cursor with custom configuration
      this.currentCursor = new WebGLBallpitCursor({
        configOverrides: {
          // Using default configuration from ballpit-cursor.js
          // You can customize: COUNT, MIN_SIZE, MAX_SIZE, GRAVITY, FRICTION, etc.
          collisionSoundUrl: './sfx/glass-clink.mp3' // Custom collision sound effect
        },
        autoMouseEvents: false, // We handle input via addCursorListener instead
      });
      
      // Update state directly without sending to Firebase
      // (we're already syncing from Firebase, so no need to send back)
      this.currentType = "cursor-app/ballpit";
      document.body.setAttribute('app-type', "cursor-app/ballpit");
      this.switching = false;
      
      // Apply current volume setting/mute state to the new cursor
      this.updateAppVolume();
    });
  },

  /**
   * PRIVATE: Actually switch to fluid cursor
   * 
   * This method performs the actual cursor switch. It's called by the
   * firebaseOnValue callback when ANY user (including this one) changes
   * the cursor type to fluid.
   * 
   * PROCESS:
   * 1. Check if already switching (prevent race conditions)
   * 2. Destroy the current cursor and clean up resources
   * 3. Create new WebGLFluidCursor instance with custom config
   * 4. Add initial splash effect to kickstart the simulation
   * 5. Update state variables (but DON'T send to Firebase again)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToFluid: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      // Create the fluid cursor with optimized configuration
      this.currentCursor = new WebGLFluidCursor({
        configOverrides: {
          SPLAT_RADIUS: 0.2,        // Size of fluid splashes
          SPLAT_FORCE: 6000,        // Force applied by splashes
          COLOR_UPDATE_SPEED: 5,    // Speed of color transitions
          DENSITY_DISSIPATION: 0.5, // How quickly density fades
          VELOCITY_DISSIPATION: 1.5, // How quickly velocity fades
        },
        autoMouseEvents: false, // We handle input via addCursorListener instead
        onReady: (fc) => {
          // Create an initial splash in the center to show the effect
          if (fc.splashAtClient) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            fc.splashAtClient(cx, cy, [0.5, 0.5, 0.5], "mouse");
          }
        },
      });
      
      // Update state directly without sending to Firebase
      // (we're already syncing from Firebase, so no need to send back)
      this.currentType = "cursor-app/fluid";
      document.body.setAttribute('app-type', "cursor-app/fluid");
      this.switching = false;
      
      // Apply current volume setting/mute state to the new cursor
      this.updateAppVolume();
    });
  },

  /**
   * PRIVATE: Actually switch to metaballs cursor
   * 
   * This method performs the actual cursor switch. It's called by the
   * firebaseOnValue callback when ANY user (including this one) changes
   * the cursor type to metaballs.
   * 
   * PROCESS:
   * 1. Check if already switching (prevent race conditions)
   * 2. Destroy the current cursor and clean up resources
   * 3. Create new WebGLMetaBallsCursor instance with organic blob config
   * 4. Update state variables (but DON'T send to Firebase again)
   * 
   * @memberof cursorApp
   * @private
   */
  _switchToMetaBalls: function() {
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    Promise.resolve(this.destroyCurrentCursor()).then(() => {
      // Create the metaballs cursor with organic blob effects
      this.currentCursor = new WebGLMetaBallsCursor({
        configOverrides: {
          BALL_COUNT: 15,           // Number of animated metaballs
          ANIMATION_SIZE: 30,       // Size of the animation area
          CURSOR_BALL_SIZE: 3,      // Size of cursor metaball
          SPEED: 0.3,               // Animation speed
          CLUMP_FACTOR: 1,          // How tightly balls clump together
          HOVER_SMOOTHNESS: 0.05,   // Cursor following smoothness (lower = smoother)
          COLOR: [1, 1, 1],         // Main color (white RGB 0-1)
          CURSOR_COLOR: [1, 1, 1],  // Cursor metaball color (white RGB 0-1)
          ENABLE_TRANSPARENCY: true, // Enable alpha transparency for smooth edges
          collisionSoundUrl: './sfx/water-drip.mp3' // Custom collision sound effect
        },
        autoMouseEvents: false, // We handle input via addCursorListener instead
      });
      
      // Update state directly without sending to Firebase
      // (we're already syncing from Firebase, so no need to send back)
      this.currentType = "cursor-app/metaballs";
      document.body.setAttribute('app-type', "cursor-app/metaballs");
      this.switching = false;
      
      // Apply current volume setting/mute state to the new cursor
      this.updateAppVolume();
    });
  },
  
  // ========================
  // RESOURCE MANAGEMENT
  // ========================
  
  /**
   * Clean up current cursor instance and free resources
   * 
   * This method safely destroys the current cursor before switching to a new one.
   * It calls the cursor's destroy() method which:
   * - Removes the canvas from the DOM
   * - Cleans up WebGL contexts
   * - Removes event listeners
   * - Cancels animation frames
   * 
   * This prevents memory leaks and ensures smooth transitions between cursor types.
   * 
   * @memberof cursorApp
   * @returns {Promise<void>} Promise that resolves when cleanup is complete
   * @private
   */
  destroyCurrentCursor: function() {
    if (this.currentCursor && this.currentCursor.destroy) {
      this.currentCursor.destroy();
      this.currentCursor = null;
      return Promise.resolve();
    }
    return Promise.resolve();
  },
  
  // ========================
  // INPUT HANDLING
  // ========================
  
  /**
   * Update pointer position for the current cursor
   * 
   * This is the unified entry point for all pointer updates (mouse, touch, eye gaze).
   * It forwards the position data to the current cursor's input manager, which
   * handles the cursor-specific logic for that pointer type.
   * 
   * CALLED BY:
   * - addCursorListener callback (receives all users' cursors from Squidly)
   * - Local mousemove event handler (for local mouse movements)
   * 
   * PARAMETERS:
   * @param {number} x - X coordinate in pixels (client coordinates)
   * @param {number} y - Y coordinate in pixels (client coordinates)
   * @param {Array|string|null} [color=null] - Optional color for the pointer
   *                                            (can be RGB array or color string)
   * @param {string|null} [userId=null] - User identifier (e.g., "host-eyes",
   *                                       "participant-mouse", "user-123")
   * 
   * @memberof cursorApp
   * @public
   */
  updatePointerPosition: function(x, y, color = null, userId = null) {
    // Safety check: only update if we have an active cursor with input manager
    if (!this.currentCursor || !this.currentCursor.inputManager) {
      return;
    }
    
    // Forward to the cursor's input manager
    this.currentCursor.inputManager.updatePointerPosition(
      x, 
      y, 
      color, 
      userId || "mouse" // Default to "mouse" if no userId provided
    );
  },
  
  // ========================
  // AUDIO MANAGEMENT
  // ========================

  /**
   * Current system volume level (0.0 to 1.0)
   * @type {number}
   */
  appVolume: 1.0,

  /**
   * Update the effective volume on the current cursor
   * 
   * Calculates the final volume based on the system volume setting
   * and the local mute state, then applies it to the active cursor.
   * 
   * @memberof cursorApp
   * @public
   */
  updateAppVolume: function() {
    // Calculate effective volume
    // If muted, volume is 0. Otherwise, use system volume.
    const effectiveVolume = this.isMuted ? 0 : this.appVolume;
    
    // Apply to current cursor if it exists and has setVolume method
    if (this.currentCursor && typeof this.currentCursor.setVolume === 'function') {
      this.currentCursor.setVolume(effectiveVolume);
    }
  },

};

// =============================================================================
// EVENT HANDLERS AND INITIALIZATION
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  
  // -----------------------------------------------------------------------
  // STEP 1: Implement Volume Sync with System Settings
  // -----------------------------------------------------------------------
  
  // 1. Determine volume settings path based on user type
  // Use session_info.user (e.g., "host" or "participant") to construct the key
  const userType = (typeof session_info !== 'undefined' && session_info.user) ? session_info.user : 'host';
  const volumePath = `${userType}/volume/level`;

  // 2. Get initial volume
  if (SquidlyAPI.getSettings) {
    SquidlyAPI.getSettings(volumePath, (value) => {
      // Volume is 0-100, convert to 0-1
      window.cursorApp.appVolume = (typeof value === 'number' ? value : 70) / 100;
      window.cursorApp.updateAppVolume();
    });
  }

  // 3. Listen for volume changes
  if (SquidlyAPI.addSettingsListener) {
    SquidlyAPI.addSettingsListener(volumePath, (value) => {
      // Volume is 0-100, convert to 0-1
      window.cursorApp.appVolume = (typeof value === 'number' ? value : 70) / 100;
      window.cursorApp.updateAppVolume();
    });
  }

  // -----------------------------------------------------------------------
  // STEP 2: Initialize with ballpit cursor
  // -----------------------------------------------------------------------
  window.cursorApp._switchToBallpit();

  // -----------------------------------------------------------------------
  // STEP 3: Listen for cursor type changes via Firebase
  // -----------------------------------------------------------------------
  SquidlyAPI.firebaseOnValue("cursor-app/currentType", (value) => {
    if (value !== window.cursorApp.currentType) {
      const methodName = CURSOR_TYPE_METHODS[value];
      
      if (methodName && typeof window.cursorApp[methodName] === 'function') {
        window.cursorApp.syncingFromParent = true;
        
        // Switch cursor
        window.cursorApp[methodName]();

        // Apply current volume to the new cursor!
        // We defer this slightly to ensure the promise in _switchToXXX has resolved
        // and currentCursor is set. Actually _switchToXXX updates currentCursor inside
        // the promise chain.
        // But since we can't easily hook into that promise return here without changing
        // _switchToXXX signature, we can rely on updateAppVolume checking for currentCursor.
        // Better: Update _switchToXXX methods to call updateAppVolume, OR
        // just set a timeout here, OR modify the methods.
        // Modifying the methods is cleaner. I will do that in a separate edit block for clarity.
        
        window.cursorApp.syncingFromParent = false;
      }
    }
  });

  // -----------------------------------------------------------------------
  // STEP 4: Register for multi-user cursor updates
  // -----------------------------------------------------------------------
  SquidlyAPI.addCursorListener((data) => {
    window.cursorApp.updatePointerPosition(
      data.x,    
      data.y,    
      null,      
      data.user  
    );
  });

  // -----------------------------------------------------------------------
  // STEP 5: Create the grid icon button for cursor switching
  // -----------------------------------------------------------------------
  SquidlyAPI.setIcon(1, 0, {
    symbol: "change",
    displayValue: "Change Cursor",
    type: "action",
  }, (value) => {
    const appTypes = Object.keys(CURSOR_TYPE_METHODS);
    const currentIndex = appTypes.indexOf(window.cursorApp.currentType);
    const nextIndex = (currentIndex + 1) % appTypes.length;
    const nextAppType = appTypes[nextIndex];
    window.cursorApp.requestCursorSwitch(nextAppType);
  });

  // -----------------------------------------------------------------------
  // STEP 7: Create mute/unmute button using cursor-app/isMuted
  // -----------------------------------------------------------------------
  window.cursorApp.isMuted = false;

  SquidlyAPI.firebaseOnValue("cursor-app/isMuted", (isMuted) => {
    window.cursorApp.isMuted = !!isMuted;
    
    // Update button appearance
    updateMuteButton(window.cursorApp.isMuted);
    
    // Apply volume update (handles the muting)
    window.cursorApp.updateAppVolume();
  });

  const muteButtonCallback = () => {
    const newState = !window.cursorApp.isMuted;
    SquidlyAPI.firebaseSet("cursor-app/isMuted", newState);
  };
  
  function updateMuteButton(isMuted) {
    SquidlyAPI.setIcon(2, 0, {
      symbol: isMuted ? "soundOff" : "soundOn",
      displayValue: isMuted ? "Sound Off" : "Sound On",
      type: "action",
      active: isMuted,
    }, muteButtonCallback);
  }
  

  
  if (typeof SquidlyAPI.setIcon !== 'undefined') {
    updateMuteButton(false);
  } else {
    console.log("[Mute Button] setIcon not available - cannot create mute button");
  }
});