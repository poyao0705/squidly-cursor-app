document.addEventListener("DOMContentLoaded", () => {
  // let fluidCursor = new WebGLFluidCursor({
  //   configOverrides: {
  //     SPLAT_RADIUS: 0.2,
  //     // SPLAT_FORCE: 6000,
  //     SPLAT_FORCE: 6000,
  //     COLOR_UPDATE_SPEED: 5,
  //     DENSITY_DISSIPATION: 0.5,
  //     VELOCITY_DISSIPATION: 1.5,
  //   },
  //   autoMouseEvents: false,
  // });
  let ballpit = new WebGLBallpitCursor({
    configOverrides: {
      // COUNT: 15, // Use default from ballpit-cursor.js
      // tweak more: MIN_SIZE, MAX_SIZE, GRAVITY, etc.
    },
    autoMouseEvents: false, // keep false since you already attach your own handlers
  });

  document.addEventListener("mousemove", (e) => {
    ballpit.inputManager.updatePointerPosition(e.clientX, e.clientY, null, "mouse");
  });

  // // Add your own mouse event handlers (no duplicates)
  // document.addEventListener("mousemove", (e) => {
  //   // Create fluid trails on movement
  //   fluidCursor.inputManager.updatePointerPosition(e.clientX, e.clientY);
  // });

  // // Add keyboard controls
  // document.addEventListener("keydown", (e) => {
  //   if (e.key === " ") {
  //     // Spacebar
  //     console.log("spacebar pressed from app.js");
  //     fluidCursor.destroy();
  //     fluidCursor = new WebGLFluidCursor({
  //       configOverrides: {
  //         SPLAT_RADIUS: 0.2,
  //         SPLAT_FORCE: 6000,
  //         COLOR_UPDATE_SPEED: 10,
  //       },
  //       autoMouseEvents: false,
  //     });
  //   }
  // });

  // // let fullWidth = 0;
  // // let fullHeight = 0;

  // let fullWidth = 0;
  // let fullHeight = 0;

  // ADD THIS: Listen for eye gaze messages from SquidlyV3
  window.addEventListener("message", (event) => {
    // user format is "host-eyes" or "participant-eyes"
    // should split user by "-" and get the first part
    if (!event.data) {
      return;
    }

    ballpit.inputManager.updatePointerPosition(
      event.data.x,
      event.data.y,
      null, // Let system generate colors dynamically
      event.data.user || "default"
    );
    // const pointerId = event.data.user || "default";
    // const cursorType = pointerId.split("-")[1];
    // if (cursorType === "eyes") {
    //   const { x, y, bbox, source } = event.data;
    //   // assign fullWidth and fullHeight to the bbox[1]._x and bbox[1]._y
    //   if (source === "local") {
    //     fullWidth = bbox[1]._x;
    //     fullHeight = bbox[1]._y;
    //   }
    //   // Use user field as the pointer ID to distinguish between different eye gaze sources
    //   const eyeGazeX = x * fullWidth;
    //   const eyeGazeY = y * fullHeight;

    //   // Use eye gaze exactly like mouse cursor
    //   // But with different pointer IDs for multiple users
    //   ballpit.inputManager.updatePointerPosition(
    //     eyeGazeX,
    //     eyeGazeY,
    //     null, // Let system generate colors dynamically
    //     pointerId
    //   );
    // } else if (cursorType === "mouse") {
    //   // use mouse cursor
    //   // console.log('mouse cursor', event.data.user);
    //   // console.log('event.data', event.data);
      
    //   ballpit.inputManager.updatePointerPosition(
    //     event.data.x,
    //     event.data.y,
    //     null, // Let system generate colors dynamically
    //     pointerId
    //   );
    // }
  });
});
