# Cursor Splash

A high-performance collection of interactive cursor effects for Squidly applications, featuring advanced fluid dynamics, 3D ball physics, and organic metaball simulations.

**Cursor Splash** brings beautiful, interactive visual effects to your Squidly sessions. Experience three unique WebGL-powered cursor effects that respond to mouse movements and eye gaze, with synchronized multi-user support.

[View Live Demo](https://cursor-splash.squidly.com.au/) | [Squidly Platform](https://squidly.com.au)

## ✨ Features

- **🌊 WebGL Fluid Cursor**: Realistic fluid dynamics with custom WebGL shaders
- **🎈 WebGL Ballpit Cursor**: Interactive 3D ball physics with THREE.js
- **🔮 WebGL MetaBalls Cursor**: Organic blob effects with smooth metaball rendering
- **🔊 Collision Sound Effects**: Interactive audio feedback for cursor-to-ball collisions (Web Audio API)
- **👁️ Eye Tracking Support**: Full integration with Squidly eye gaze data
- **🎮 Multiple Input Sources**: Mouse, touch, and eye tracking support
- **📦 Exportable Modules**: Clean ES6 module exports
- **🔧 Configurable**: Extensive configuration options for all cursor types
- **🧹 Resource Management**: Automatic cleanup and memory management
- **📱 Responsive**: Automatic canvas positioning and iframe support
- **🔄 Squidly Integration**: Full integration with Squidly Apps API for multi-user experiences

## 🚀 Quick Start

### ES6 Modules (Recommended)

```javascript
import { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor } from './index.js';

// Fluid cursor
const fluidCursor = new WebGLFluidCursor({
  configOverrides: {
    SPLAT_RADIUS: 0.3,
    SPLAT_FORCE: 8000,
    COLOR_UPDATE_SPEED: 10
  }
});

// Ballpit cursor
const ballpit = new WebGLBallpitCursor({
  configOverrides: {
    COUNT: 100,
    GRAVITY: 0.05,
    FRICTION: 0.99
  }
});

// MetaBalls cursor
const metaballs = new WebGLMetaBallsCursor({
  configOverrides: {
    BALL_COUNT: 15,
    ANIMATION_SIZE: 30,
    SPEED: 0.3
  }
});
```

### Script Tags

```html
<script type="module" src="app.js"></script>
```

### Using in Squidly

To use Cursor Splash in a Squidly session:

1. **Load the app** in your Squidly session
2. **Switch cursor effects** by clicking the grid icon button
3. **Move your mouse or use eye gaze** to interact with the effects
4. **Multi-user support**: All participants see synchronized cursor effects

The app automatically:
- Receives cursor data from all users (mouse and eye gaze)
- Synchronizes cursor type changes across all users
- Handles cleanup when switching between effects

## 📖 API Reference

### WebGLFluidCursor

High-performance WebGL fluid simulation with advanced fluid dynamics.

#### Constructor

```javascript
new WebGLFluidCursor(options)
```

**Parameters:**
- `options.configOverrides` - Override simulation configuration
- `options.autoMouseEvents` - Whether to automatically handle mouse events

#### Methods

- `splashAtClient(x, y, color, id)` - Create manual splash effect
- `destroy()` - Clean up resources and remove from DOM

#### Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `SPLAT_RADIUS` | number | 0.2 | Size of fluid splashes (0.1-1.0) |
| `SPLAT_FORCE` | number | 6000 | Force applied by splashes (1000-10000) |
| `COLOR_UPDATE_SPEED` | number | 10 | Speed of color transitions (1-20) |
| `DENSITY_DISSIPATION` | number | 1 | How quickly density fades (0.1-2.0) |
| `VELOCITY_DISSIPATION` | number | 3 | How quickly velocity fades (0.1-5.0) |

### WebGLBallpitCursor

Interactive 3D ball physics simulation with THREE.js.

#### Constructor

```javascript
new WebGLBallpitCursor(options)
```

**Parameters:**
- `options.configOverrides` - Override physics configuration
- `options.autoMouseEvents` - Whether to automatically handle mouse events

#### Methods

- `pause()` - Pause physics simulation
- `play()` - Resume physics simulation
- `enableSound()` - Enable collision sound effects
- `disableSound()` - Disable collision sound effects
- `loadCollisionSound(audioUrl)` - Load custom audio file for collisions (async)
- `destroy()` - Clean up resources and remove from DOM

#### Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `COUNT` | number | 50 | Number of balls in simulation |
| `MIN_SIZE` | number | 0.6 | Minimum ball size (0.1-2.0) |
| `MAX_SIZE` | number | 1.2 | Maximum ball size (0.5-3.0) |
| `GRAVITY` | number | 0.02 | Gravity strength (0.01-0.1) |
| `FRICTION` | number | 0.998 | Air resistance (0.9-0.999) |
| `WALL_BOUNCE` | number | 0.95 | Bounce factor for walls (0.1-1.0) |
| `collisionSoundUrl` | string | null | URL to audio file for collision sounds |

### WebGLMetaBallsCursor

Organic metaball simulation with smooth blob effects and cursor interaction.

#### Constructor

```javascript
new WebGLMetaBallsCursor(options)
```

**Parameters:**
- `options.configOverrides` - Override metaball configuration
- `options.autoMouseEvents` - Whether to automatically handle mouse events

#### Methods

- `pause()` - Pause metaball animation
- `play()` - Resume metaball animation
- `destroy()` - Clean up resources and remove from DOM

#### Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `BALL_COUNT` | number | 15 | Number of animated metaballs |
| `ANIMATION_SIZE` | number | 30 | Size of the animation area |
| `CURSOR_BALL_SIZE` | number | 3 | Size of cursor metaball |
| `SPEED` | number | 0.3 | Animation speed (0.1-1.0) |
| `CLUMP_FACTOR` | number | 1 | Clumping strength (0.5-2.0) |
| `HOVER_SMOOTHNESS` | number | 0.05 | Cursor smoothness (0.01-0.2) |

## 🎮 Usage Examples

### Basic Fluid Cursor

```javascript
import { WebGLFluidCursor } from './index.js';

const fluidCursor = new WebGLFluidCursor();

// Update cursor position
fluidCursor.inputManager.updatePointerPosition(x, y, color, id);

// Create manual splash
fluidCursor.splashAtClient(400, 300, [1, 0, 0], "splash");
```

### Basic Ballpit Cursor

```javascript
import { WebGLBallpitCursor } from './index.js';

const ballpit = new WebGLBallpitCursor({
  configOverrides: {
    COUNT: 100,
    GRAVITY: 0.05
  }
});

// Update cursor position
ballpit.inputManager.updatePointerPosition(x, y, color, id);

// Pause/resume physics
ballpit.pause();
ballpit.play();

// Enable/disable collision sound effects
ballpit.enableSound();   // Plays sounds when cursor ball collides with other balls
ballpit.disableSound();  // Mutes collision sounds

// Load custom collision sound (optional)
await ballpit.loadCollisionSound('./sounds/boop.mp3');

// Or specify sound URL at initialization
const ballpitWithSound = new WebGLBallpitCursor({
  configOverrides: {
    COUNT: 100,
    GRAVITY: 0.05,
    collisionSoundUrl: './sfx/glass-clink.mp3'  // Use custom audio file
  }
});
```

### Basic MetaBalls Cursor

```javascript
import { WebGLMetaBallsCursor } from './index.js';

const metaballs = new WebGLMetaBallsCursor({
  configOverrides: {
    BALL_COUNT: 20,
    ANIMATION_SIZE: 40,
    SPEED: 0.5
  }
});

// Update cursor position
metaballs.inputManager.updatePointerPosition(x, y, color, id);

// Pause/resume animation
metaballs.pause();
metaballs.play();
```

### Eye Tracking Integration

```javascript
// Listen for eye gaze messages
window.addEventListener("message", (event) => {
  if (event.data && event.data.mode === "eye-gaze") {
    const { user, x, y, bbox } = event.data;
    
    // Convert normalized coordinates to pixels
    const eyeGazeX = x * bbox[1]._x;
    const eyeGazeY = y * bbox[1]._y;
    
    // Update cursor
    cursor.inputManager.updatePointerPosition(eyeGazeX, eyeGazeY, null, user);
  }
});
```

### Unified Cursor Management

```javascript
// Using the unified cursor app
window.cursorApp.switchToFluid();
window.cursorApp.switchToBallpit();
window.cursorApp.switchToMetaBalls();

// Update pointer position (works with all cursor types)
window.cursorApp.updatePointerPosition(x, y, color, userId);

// Current cursor type
console.log(window.cursorApp.currentType); // 'cursor-app/ballpit', 'cursor-app/fluid', or 'cursor-app/metaballs'
```

## 🎯 Input Manager API

All cursor types use the same input management system:

```javascript
// Update pointer position
cursor.inputManager.updatePointerPosition(x, y, color, id);

// Remove pointer
cursor.inputManager.removePointer(id);

// Get active pointers
cursor.inputManager.getActivePointers();

// Clean up inactive users
cursor.inputManager.cleanupInactiveUsers(timeoutMs);
```

## 🎮 Controls

When using the unified app:

- **Grid Icon Button** - Cycle through available cursor types (Ballpit → Fluid → MetaBalls)
- **Mouse Movement** - Interact with the cursor effects

## 🔌 Squidly Apps API

This app integrates with the Squidly platform using the Squidly Apps API. These functions enable communication between your app and the Squidly parent frame, allowing for multi-user experiences and Firebase integration.

### `setIcon(x, y, options, callback)`

Creates an interactive icon button in the Squidly grid interface.

**Parameters:**
- `y` (number): Grid Y position (0-indexed)
- `x` (number): Grid X position (0-indexed)
- `options` (object): Icon configuration
  - `symbol` (string): Icon identifier (e.g., "switch", "play", "pause")
  - `displayValue` (string): Tooltip text shown on hover
  - `type` (string): Icon type (e.g., "action", "toggle")
- `callback` (function): Function called when icon is clicked
  - Receives `value` parameter with the icon's current state

**Example:**
```javascript
setIcon(1, 0, {
  symbol: "switch",
  displayValue: "Change Cursor",
  type: "action",
}, (value) => {
  // Handle icon click
  window.cursorApp.switchToFluid();
});
```

**Usage in Cursor Splash:**
This app uses `setIcon` to create a "Change Cursor" button that cycles through the three cursor types (lines 304-317 in app.js).

---

### `firebaseOnValue(path, callback)`

Listens for real-time updates to a Firebase path in the Squidly session.

**Parameters:**
- `path` (string): Firebase database path to listen to (e.g., "cursor-app/currentType")
- `callback` (function): Function called when the value at path changes
  - Receives the new `value` as parameter

**Example:**
```javascript
firebaseOnValue("cursor-app/currentType", (value) => {
  console.log("Cursor type changed to:", value);
  // Switch cursor based on the new value
  if (value === "cursor-app/fluid") {
    window.cursorApp._switchToFluid();
  }
});
```

**Usage in Cursor Splash:**
This app listens to `cursor-app/currentType` to synchronize cursor changes across all connected users. When one user changes the cursor type, all other users see the same cursor effect (lines 279-292 in app.js).

---

### `firebaseSet(path, value)`

Sets a value in the Firebase database for the current Squidly session.

**Parameters:**
- `path` (string): Firebase database path to set (e.g., "cursor-app/currentType")
- `value` (any): Value to store (can be string, number, object, etc.)

**Example:**
```javascript
firebaseSet("cursor-app/currentType", "cursor-app/ballpit");
```

**Usage in Cursor Splash:**
This app uses `firebaseSet` to broadcast cursor type changes to all users in the session (line 30 and line 67 in app.js).

---

### `addCursorListener(callback)`

Registers a listener for all cursor/pointer updates in the Squidly session, including eye gaze and mouse movements from all users.

**Parameters:**
- `callback` (function): Function called for each cursor update
  - Receives `data` object with:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `user` (string): User identifier (e.g., "host-eyes", "participant-mouse")

**Example:**
```javascript
addCursorListener((data) => {
  console.log(`User ${data.user} moved cursor to (${data.x}, ${data.y})`);
  // Update your app with the cursor position
  window.cursorApp.updatePointerPosition(data.x, data.y, null, data.user);
});
```

**Usage in Cursor Splash:**
This app uses `addCursorListener` to receive cursor positions from all users in the Squidly session and display them in the current cursor effect. This enables multi-user interaction where everyone can see each other's cursors (lines 295-302 in app.js).

**Note:** This function is provided by the Squidly framework and automatically handles multiple input sources:
- Eye gaze tracking (when enabled)
- Mouse movements
- Touch inputs
- Multiple simultaneous users

## 🔧 Advanced Configuration

### Fluid Cursor Advanced Settings

```javascript
const fluidCursor = new WebGLFluidCursor({
  configOverrides: {
    SIM_RESOLUTION: 256,        // Higher = better quality, lower performance
    DYE_RESOLUTION: 2048,       // Higher = better visual quality
    PRESSURE_ITERATIONS: 30,    // More iterations = more stable fluid
    CURL: 5,                    // Higher = more swirling effects
  }
});
```

### Ballpit Cursor Advanced Settings

```javascript
const ballpit = new WebGLBallpitCursor({
  configOverrides: {
    COUNT: 200,                 // More balls = more impressive effect
    LEADER_EASE: 0.1,          // Lower = snappier cursor following
    LIGHT_INTENSITY: 1000,     // Higher = brighter lighting
    PALETTE: [0xff0000, 0x00ff00, 0x0000ff], // Custom colors
  }
});
```

### MetaBalls Cursor Advanced Settings

```javascript
const metaballs = new WebGLMetaBallsCursor({
  configOverrides: {
    BALL_COUNT: 20,             // Number of animated metaballs
    ANIMATION_SIZE: 40,         // Size of the animation area
    CURSOR_BALL_SIZE: 5,        // Size of cursor metaball
    SPEED: 0.5,                 // Animation speed
    CLUMP_FACTOR: 1.5,          // How tightly balls clump together
    HOVER_SMOOTHNESS: 0.03,     // Cursor following smoothness (lower = smoother)
    COLOR: [1, 0.5, 0],         // Main color (RGB 0-1)
    CURSOR_COLOR: [1, 1, 1],    // Cursor color (RGB 0-1)
    ENABLE_TRANSPARENCY: true,  // Enable alpha transparency
  }
});
```

## 🌐 Browser Support

- **Modern browsers** with WebGL support
- **ES6 modules** support required
- **THREE.js** (automatically loaded for ballpit cursor)
- **WebGL2** preferred, WebGL1 fallback available

## 📦 Module Exports

The library supports multiple module formats:

```javascript
// ES6 Modules
import { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor } from './index.js';

// CommonJS
const { WebGLFluidCursor } = require('./fluid-cursor.js');
const { WebGLBallpitCursor } = require('./ballpit-cursor.js');
const { WebGLMetaBallsCursor } = require('./metaballs-cursor.js');

// Global (script tags)
window.WebGLFluidCursor
window.WebGLBallpitCursor
window.WebGLMetaBallsCursor
```

## 🧹 Resource Management

All cursor types automatically manage resources:

- **WebGL contexts** are properly cleaned up
- **Event listeners** are removed on destroy
- **Memory leaks** are prevented with proper cleanup
- **Canvas elements** are removed from DOM
- **Animation frames** are cancelled on destroy
- **THREE.js scenes** are disposed properly (for Ballpit cursor)

## 📝 About

**Cursor Splash** is a Squidly app created by Po-Yao Huang. This app demonstrates the power of the Squidly platform with real-time multi-user cursor effects powered by WebGL.

Version: 1.0.1

## 🤝 Squidly Platform

This app is designed to run within the [Squidly platform](https://squidly.com.au), which provides:
- Multi-user eye gaze tracking
- Real-time Firebase synchronization
- Interactive grid interface
- Cross-user cursor sharing

## 📞 Support

For questions about:
- **This app**: Contact Po-Yao Huang
- **Squidly platform**: Visit [squidly.com.au](https://squidly.com.au)
- **Technical issues**: Open an issue on the GitHub repository