/**
 * Cursor Effects Library
 * A collection of interactive cursor effects for web applications
 */

// Import cursor classes
import WebGLFluidCursor from './fluid-cursor.js';
import WebGLBallpitCursor from './ballpit-cursor.js';
import WebGLMetaBallsCursor from './metaballs-cursor.js';

// Re-export for clean imports
export { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor };
export default { WebGLFluidCursor, WebGLBallpitCursor, WebGLMetaBallsCursor };

// Also make available globally for script tag usage
if (typeof window !== 'undefined') {
  window.WebGLFluidCursor = WebGLFluidCursor;
  window.WebGLBallpitCursor = WebGLBallpitCursor;
  window.WebGLMetaBallsCursor = WebGLMetaBallsCursor;
}
