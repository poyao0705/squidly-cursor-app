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
      "mouse",
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
      const { x, y, bbox, hidden } = event.data;

      if (!hidden) {
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

        // Use eye gaze exactly like mouse cursor (use mouse input strategy)
        fluidCursor.inputManager.updatePointerPosition(
          "mouse",
          eyeGazeX,
          eyeGazeY
        );
      }
    }
  });
});
