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

import { WebGLFluidCursor, WebGLBallpitCursor } from './index.js';

/**
 * Global cursor management object
 * Provides unified interface for managing cursor effects and input handling
 * 
 * @namespace cursorApp
 * @type {Object}
 */
window.cursorApp = {
  /** @type {string|null} Current active cursor type ('ballpit' or 'fluid') */
  currentType: null,
  
  /** @type {WebGLFluidCursor|WebGLBallpitCursor|null} Current cursor instance */
  currentCursor: null,
  
  /** @type {boolean} Flag to prevent rapid cursor switching during transitions */
  switching: false,
  
  /**
   * Set the current cursor type and update UI/attributes
   * 
   * @param {string} type - The cursor type to set ('ballpit' or 'fluid')
   * @memberof cursorApp
   */
  setCursorType: function(type) {
    if (this.currentType !== type) {
      this.currentType = type;
      // Set data attribute on body for app-base-api to observe
      document.body.setAttribute('data-cursor-type', type);
      // Update UI
      this.updateCursorUI(type);
    }
  },
  
  /**
   * Update the UI to display the current cursor type
   * 
   * @param {string} type - The cursor type to display
   * @memberof cursorApp
   * @private
   */
  updateCursorUI: function(type) {
    const cursorTypeElement = document.getElementById('cursor-type');
    if (cursorTypeElement) {
      if (type === 'ballpit') {
        cursorTypeElement.textContent = '🎈 Ballpit Cursor';
      } else if (type === 'fluid') {
        cursorTypeElement.textContent = '🌊 Fluid Cursor';
      }
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
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    this.destroyCurrentCursor().then(() => {
      this.currentCursor = new WebGLBallpitCursor({
        configOverrides: {
          // Using default configuration from ballpit-cursor.js
          // Customize: COUNT, MIN_SIZE, MAX_SIZE, GRAVITY, etc.
        },
        autoMouseEvents: false, // Use unified input system
      });
      this.setCursorType("ballpit");
      this.switching = false;
      console.log("🎈 Switched to Ballpit Cursor");
    });
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
    if (this.switching) return; // Prevent rapid switching
    this.switching = true;
    
    this.destroyCurrentCursor().then(() => {
      this.currentCursor = new WebGLFluidCursor({
        configOverrides: {
          SPLAT_RADIUS: 0.2,        // Size of fluid splashes
          SPLAT_FORCE: 6000,        // Force applied by splashes
          COLOR_UPDATE_SPEED: 5,    // Speed of color transitions
          DENSITY_DISSIPATION: 0.5, // How quickly density fades
          VELOCITY_DISSIPATION: 1.5, // How quickly velocity fades
        },
        autoMouseEvents: false, // Use unified input system
      });
      this.setCursorType("fluid");
      this.switching = false;
      console.log("🌊 Switched to Fluid Cursor");
      
      // Create an initial splash to kickstart the fluid effect
      setTimeout(() => {
        if (this.currentCursor.splashAtClient) {
          this.currentCursor.splashAtClient(400, 300, [0.5, 0.5, 0.5], "mouse");
        }
      }, 100);
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
      return new Promise(resolve => {
        setTimeout(() => {
          this.currentCursor = null;
          resolve();
        }, 50); // 50ms delay for cleanup
      });
    }
    this.currentCursor = null;
    return Promise.resolve();
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
    
    // Safety check for undefined coordinates
    if (x === undefined || y === undefined || x === null || y === null) {
      console.warn("Invalid coordinates passed to updatePointerPosition:", x, y);
      return;
    }
    
    // Additional safety check for fluid cursor
    if (this.currentType === "fluid" && !this.currentCursor.canvas) {
      console.warn("Fluid cursor canvas is null, skipping pointer update");
      return;
    }
    
    if (this.currentType === "ballpit") {
      // Ballpit cursor uses "default" as fallback user ID
      this.currentCursor.inputManager.updatePointerPosition(x, y, color, userId || "default");
    } else if (this.currentType === "fluid") {
      // Fluid cursor uses "mouse" as fallback user ID for proper pointer management
      this.currentCursor.inputManager.updatePointerPosition(x, y, color, userId || "mouse");
    }
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
  // Initialize with ballpit cursor by default
  window.cursorApp.switchToBallpit();

  // Mouse event handler that works with any cursor type
  document.addEventListener("mousemove", (e) => {
    window.cursorApp.updatePointerPosition(e.clientX, e.clientY, null, "mouse");
  });

  // Keyboard controls for cursor switching
  document.addEventListener("keydown", (e) => {
    switch(e.key) {
      case " ": // Spacebar - Toggle between cursors
        e.preventDefault();
        if (window.cursorApp.currentType === "ballpit") {
          window.cursorApp.switchToFluid();
        } else {
          window.cursorApp.switchToBallpit();
        }
        break;
      case "1": // Number 1 - Switch to ballpit
        e.preventDefault();
        window.cursorApp.switchToBallpit();
        break;
      case "2": // Number 2 - Switch to fluid
        e.preventDefault();
        window.cursorApp.switchToFluid();
        break;
      case "Escape": // Escape - Toggle cursors (alternative)
        e.preventDefault();
        if (window.cursorApp.currentType === "ballpit") {
          window.cursorApp.switchToFluid();
        } else {
          window.cursorApp.switchToBallpit();
        }
        break;
    }
  });

  // Listen for eye gaze messages from SquidlyV3
  window.addEventListener("message", (event) => {
    if (!event.data) {
      return;
    }

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

  // Display controls and status
  console.log("🎮 Unified Cursor System Ready!");
  console.log("🎮 Controls:");
  console.log("  SPACEBAR or ESC - Toggle between cursors");
  console.log("  1 - Switch to Ballpit Cursor");
  console.log("  2 - Switch to Fluid Cursor");
  console.log("  Move your mouse to see the effects!");
  console.log(`🎯 Current cursor: ${window.cursorApp.currentType}`);
});