/* input-manager.js
   Unified InputManager for both Fluid Cursor and Ballpit Cursor
   - Handles multiple pointer inputs (mouse, eyegaze, etc.)
   - Supports dynamic ball assignment for multi-user scenarios
   - Provides input prioritization (mouse over eyegaze)
   - Automatic cleanup of inactive users
   - Compatible with both cursor implementations
*/

class InputManager {
  constructor(owner, options = {}) {
    this.owner = owner;
    this.options = {
      // Cursor type: 'fluid' or 'ballpit'
      cursorType: options.cursorType || 'fluid',
      // Whether to use ball assignment for eyegaze users
      useBallAssignment: options.useBallAssignment || false,
      // Default timeout for inactive users (ms)
      inactiveTimeout: options.inactiveTimeout || 5000,
      ...options
    };

    // Internal pointer storage
    this._pointers = new Map();
    
    // Ball assignment system (for ballpit cursor)
    this._eyegazeBallIndices = new Map(); // userType -> ballIndex
    this._nextAvailableBallIndex = 1; // Start from 1 (0 is reserved for mouse)
    
    // Statistics
    this._stats = {
      totalUpdates: 0,
      lastCleanup: performance.now()
    };
  }

  /**
   * Update pointer position - main entry point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate  
   * @param {Array|string|null} color - Color for the pointer
   * @param {string} id - Pointer ID (default: "default")
   */
  updatePointerPosition(x, y, color = null, id = "default") {
    const pointer = this._getOrCreatePointer(id, color);
    
    // Update pointer data
    pointer.x = x;
    pointer.y = y;
    pointer.lastSeen = performance.now();
    pointer.color = color || pointer.color;
    this._stats.totalUpdates++;

    // Handle based on cursor type
    if (this.options.cursorType === 'ballpit') {
      this._handleBallpitInput(pointer);
    } else {
      this._handleFluidInput(pointer);
    }

    // Trigger owner callback
    if (this.owner._onPointerInputChanged) {
      this.owner._onPointerInputChanged();
    }
  }

  /**
   * Handle input for ballpit cursor
   * @private
   */
  _handleBallpitInput(pointer) {
    // For ballpit, we just update the pointer data
    // The owner will handle the actual ball physics
    if (this.options.useBallAssignment && 
        pointer.id !== "mouse" && 
        (pointer.id.includes("eyes") || pointer.id.includes("gaze"))) {
      this._assignBallIndex(pointer.id);
    }
  }

  /**
   * Handle input for fluid cursor
   * @private
   */
  _handleFluidInput(pointer) {
    // For fluid cursor, we need to scale coordinates and update move data
    if (this.owner._scaleByPixelRatio && this.owner._updatePointerMoveData) {
      const posX = this.owner._scaleByPixelRatio(pointer.x);
      const posY = this.owner._scaleByPixelRatio(pointer.y);
      this.owner._updatePointerMoveData(pointer, posX, posY, pointer.color);
    }
  }

  /**
   * Get or create a pointer
   * @private
   */
  _getOrCreatePointer(id, color = null) {
    if (!this._pointers.has(id)) {
      this._pointers.set(id, {
        id: id,
        x: 0,
        y: 0,
        lastSeen: 0,
        color: color,
        ballIndex: id === "mouse" ? 0 : null
      });
    }
    return this._pointers.get(id);
  }

  /**
   * Assign ball index to eyegaze user
   * @private
   */
  _assignBallIndex(userType) {
    if (!this._eyegazeBallIndices.has(userType)) {
      const ballIndex = this._nextAvailableBallIndex++;
      this._eyegazeBallIndices.set(userType, ballIndex);
      const pointer = this._pointers.get(userType);
      if (pointer) pointer.ballIndex = ballIndex;
      console.log(`Assigned ball index ${ballIndex} to ${userType}`);
    }
    return this._eyegazeBallIndices.get(userType);
  }

  /**
   * Release ball index from user
   * @private
   */
  _releaseBallIndex(userType) {
    if (this._eyegazeBallIndices.has(userType)) {
      const ballIndex = this._eyegazeBallIndices.get(userType);
      this._eyegazeBallIndices.delete(userType);
      this._pointers.delete(userType);
      console.log(`Released ball index ${ballIndex} from ${userType}`);
    }
  }

  // === Public API ===

  /**
   * Get all active pointers
   * @returns {Array} Array of pointer objects
   */
  getActivePointers() {
    return Array.from(this._pointers.entries()).map(([id, pointer]) => ({
      id: pointer.id,
      x: pointer.x,
      y: pointer.y,
      lastSeen: pointer.lastSeen,
      color: pointer.color,
      ballIndex: pointer.ballIndex
    }));
  }

  /**
   * Get target pointer (prioritizes mouse)
   * @returns {Object|null} Target pointer or null
   */
  getTargetPointer() {
    // First try to use mouse input
    if (this._pointers.has("mouse")) {
      return this._pointers.get("mouse");
    } else {
      // Fallback to most recent eyegaze input
      let latest = null;
      let latestTime = -1;
      for (const [id, p] of this._pointers.entries()) {
        if (p.lastSeen > latestTime) {
          latestTime = p.lastSeen;
          latest = p;
        }
      }
      return latest;
    }
  }

  /**
   * Get eyegaze ball indices
   * @returns {Map} Map of userType -> ballIndex
   */
  getEyegazeBallIndices() {
    return new Map(this._eyegazeBallIndices);
  }

  /**
   * Get pointer by ID
   * @param {string} id - Pointer ID
   * @returns {Object|null} Pointer object or null
   */
  getPointer(id) {
    return this._pointers.get(id) || null;
  }

  /**
   * Check if pointer exists
   * @param {string} id - Pointer ID
   * @returns {boolean} True if pointer exists
   */
  hasPointer(id) {
    return this._pointers.has(id);
  }

  /**
   * Remove specific pointer
   * @param {string} id - Pointer ID
   * @returns {boolean} True if removed
   */
  removePointer(id) {
    if (this._pointers.has(id)) {
      if (this.options.useBallAssignment) {
        this._releaseBallIndex(id);
      } else {
        this._pointers.delete(id);
      }
      return true;
    }
    return false;
  }

  /**
   * Cleanup inactive users
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {number} Number of users removed
   */
  cleanupInactiveUsers(timeoutMs = null) {
    const timeout = timeoutMs || this.options.inactiveTimeout;
    const now = performance.now();
    let removed = 0;
    
    const toRemove = [];
    for (const [id, pointer] of this._pointers.entries()) {
      if (id !== "mouse" && (now - pointer.lastSeen) > timeout) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => {
      if (this.options.useBallAssignment) {
        this._releaseBallIndex(id);
      } else {
        this._pointers.delete(id);
      }
      removed++;
    });
    
    if (removed > 0) {
      console.log(`Cleaned up ${removed} inactive users`);
    }
    
    return removed;
  }

  /**
   * Clear all non-mouse pointers
   * @returns {number} Number of pointers removed
   */
  clearNonMousePointers() {
    let removed = 0;
    const toRemove = [];
    
    for (const [id, pointer] of this._pointers.entries()) {
      if (id !== "mouse") {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => {
      if (this.options.useBallAssignment) {
        this._releaseBallIndex(id);
      } else {
        this._pointers.delete(id);
      }
      removed++;
    });
    
    return removed;
  }

  /**
   * Get usage statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const now = performance.now();
    const activePointers = this.getActivePointers();
    
    return {
      totalPointers: this._pointers.size,
      mouseActive: this._pointers.has("mouse"),
      eyegazeUsers: this._eyegazeBallIndices.size,
      activeBallIndices: Array.from(this._eyegazeBallIndices.values()),
      totalUpdates: this._stats.totalUpdates,
      lastCleanup: this._stats.lastCleanup,
      timeSinceLastCleanup: now - this._stats.lastCleanup,
      cursorType: this.options.cursorType,
      useBallAssignment: this.options.useBallAssignment
    };
  }

  /**
   * Update statistics (call periodically)
   * @private
   */
  _updateStats() {
    this._stats.lastCleanup = performance.now();
  }

  /**
   * Reset all data
   */
  reset() {
    this._pointers.clear();
    this._eyegazeBallIndices.clear();
    this._nextAvailableBallIndex = 1;
    this._stats = {
      totalUpdates: 0,
      lastCleanup: performance.now()
    };
  }

  /**
   * Set cursor type and reconfigure
   * @param {string} type - 'fluid' or 'ballpit'
   */
  setCursorType(type) {
    this.options.cursorType = type;
    this.options.useBallAssignment = (type === 'ballpit');
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputManager;
} else if (typeof define === 'function' && define.amd) {
  define([], function() {
    return InputManager;
  });
} else {
  // Make available globally
  window.InputManager = InputManager;
}

// ES6 module export
export default InputManager;
export { InputManager };
