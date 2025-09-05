document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("container");
  let fluidCursor = new WebGLFluidCursor({
    container: container,
    configOverrides: {
      SPLAT_RADIUS: 0.2,
      // SPLAT_FORCE: 6000,
      SPLAT_FORCE: 6000,
      COLOR_UPDATE_SPEED: 5,
      DENSITY_DISSIPATION: 0.5,
      VELOCITY_DISSIPATION: 1.5,
    },
    autoMouseEvents: false,
  });

  // Add your own mouse event handlers (no duplicates)
  document.addEventListener("mousemove", (e) => {
    // Create fluid trails on movement
    fluidCursor.inputManager.updatePointerPosition(
      e.clientX,
      e.clientY
    );
  });

  // Add keyboard controls
  document.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      // Spacebar
      console.log("spacebar pressed from app.js");
      fluidCursor.destroy();
      fluidCursor = new WebGLFluidCursor({
        container: container,
        configOverrides: {
          SPLAT_RADIUS: 0.2,
          SPLAT_FORCE: 6000,
          COLOR_UPDATE_SPEED: 10,
        },
        autoMouseEvents: false,
      });
    }
  });

  // ADD THIS: Listen for eye gaze messages from SquidlyV3
  window.addEventListener("message", (event) => {
    // console.log('message received from app.js', event);

    if (event.data && event.data.mode === "eye-gaze") {
      const { user, x, y, bbox, hidden, source } = event.data;

      // Use user field as the pointer ID to distinguish between different eye gaze sources
      const pointerId = user || "default";

      if (hidden) {
        // Remove the pointer when hidden
        fluidCursor.removePointer(pointerId);
      } else {
        // Check if we're in an iframe
        const iframe = window.frameElement;
        let eyeGazeX, eyeGazeY;

        // Convert full-screen coordinates to iframe-relative coordinates
        const iframeRect = iframe.getBoundingClientRect();
        const fullScreenX_screen = x * screen.width;
        const fullScreenY_screen = y * window.innerHeight;
        const eyeGazeX_screen = fullScreenX_screen - iframeRect.left;
        const eyeGazeY_screen = fullScreenY_screen - iframeRect.top;

        // Use screen-based coordinates (SquidlyV3 might use screen coordinates)
        eyeGazeX = eyeGazeX_screen;
        eyeGazeY = eyeGazeY_screen;

        // Use eye gaze exactly like mouse cursor
        // But with different pointer IDs for multiple users
        fluidCursor.inputManager.updatePointerPosition(
          eyeGazeX,
          eyeGazeY,
          null, // Let system generate colors dynamically
          pointerId
        );
      }
    }
  });
});
