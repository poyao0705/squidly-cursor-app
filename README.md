# Cursor Effects Library

A high-performance collection of interactive cursor effects for web applications, featuring advanced fluid dynamics and 3D ball physics simulations.

## ✨ Features

- **🌊 WebGL Fluid Cursor**: Realistic fluid dynamics with custom WebGL shaders
- **🎈 WebGL Ballpit Cursor**: Interactive 3D ball physics with THREE.js
- **👁️ Eye Tracking Support**: Full integration with eye gaze data
- **🎮 Multiple Input Sources**: Mouse, touch, and eye tracking support
- **📦 Exportable Modules**: Clean ES6 module exports with TypeScript support
- **🔧 Configurable**: Extensive configuration options for both cursors
- **🧹 Resource Management**: Automatic cleanup and memory management
- **📱 Responsive**: Automatic canvas positioning and iframe support

## 🚀 Quick Start

### ES6 Modules (Recommended)

```javascript
import { WebGLFluidCursor, WebGLBallpitCursor } from './index.js';

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
```

### Script Tags

```html
<script type="module" src="app.js"></script>
```

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

// Update pointer position (works with both cursors)
window.cursorApp.updatePointerPosition(x, y, color, userId);
```

## 🎯 Input Manager API

Both cursors use the same input management system:

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

- **SPACEBAR** or **ESC** - Toggle between cursors
- **1** - Switch to Ballpit Cursor
- **2** - Switch to Fluid Cursor
- **Mouse Movement** - Interact with the cursor effects

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

## 🌐 Browser Support

- **Modern browsers** with WebGL support
- **ES6 modules** support required
- **THREE.js** (automatically loaded for ballpit cursor)
- **WebGL2** preferred, WebGL1 fallback available

## 📦 Module Exports

The library supports multiple module formats:

```javascript
// ES6 Modules
import { WebGLFluidCursor, WebGLBallpitCursor } from './index.js';

// CommonJS
const { WebGLFluidCursor } = require('./fluid-cursor.js');

// Global (script tags)
window.WebGLFluidCursor
window.WebGLBallpitCursor
```

## 🧹 Resource Management

Both cursors automatically manage resources:

- **WebGL contexts** are properly cleaned up
- **Event listeners** are removed on destroy
- **Memory leaks** are prevented with proper cleanup
- **Canvas elements** are removed from DOM

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## 📞 Support

For questions and support, please open an issue on our GitHub repository.