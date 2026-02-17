/*
   Lightcycle scene using the LightcycleGrid helper.
*/

import { LightcycleGrid } from "./LightcycleGrid.js";
import { Bike } from "./bike.js";
import { BikeTrail } from "./biketrail.js";
import { joyStickState } from "../../render/core/controllerInput.js";

export const init = async model => {
   // Tweak these to reposition the box in world space.
   const position = [0, 1.4, -0.2];
   const gridSize = 1;
   const wallHeight = 0.05;
   const wallThickness = 0.001;

   const grid = new LightcycleGrid(model, {
      position,
      gridSize,
      wallHeight,
      wallThickness,
      floorColor: [0.2, 0.6, 0.9],
      wallColor: [0.1, 0.25, 0.35],
      gridResolution: 50,
   });

   // Place the bike so its wheels sit directly on the grid surface.
   const floorY = position[1] + 0.01;                // grid floor offset in LightcycleGrid
   // Keep this in sync with the geometry constants in Bike.update().
   const base = gridSize * 0.05;
   const wheelRadius = base * 0.16;
   const bikeY = floorY + wheelRadius;

   const bike = new Bike(model, {
      position: [position[0], bikeY, position[2]],
      gridSize,
      bodyColor: [0.15, 0.35, 0.95],
      wheelColor: [0.5, 0.2, 0.9],
      accentColor: [0.1, 0.9, 0.2],
   });

   // Tron-style trail that follows the bike.
   const bodyLength = base * 0.7;
   const trailOffset = bodyLength / 2 + wheelRadius;
   const trail = new BikeTrail(model, {
      gridSize,
      // Center the trail so its bottom sits on the floor and
      // its total height matches the bike wheel radius.
      y: floorY + wheelRadius,
      height: wheelRadius*2,
      thickness: wallThickness * 0.75,
      segmentLength: gridSize * 0.05, // granularity of the trail segments
      lifetime: 2,                    // seconds before each segment disappears
      color: [0.1, 0.9, 0.2],
      backOffset: trailOffset,        // draw the trail behind the rear wheel
   });

   // Simple game-style motion:
   // - Bike starts at center and waits.
   // - On first joystick input, it starts moving forward.
   // - Joystick changes direction while continuing motion.
   // - Hitting a wall respawns the bike at the center and pauses it again.
   const half = gridSize / 2;
   const speed = gridSize * 0.45;   // grid units per second
   const deadZone = 0.25;
   const wallMargin = 0.01;

   let isMoving = false;
   let dir = [0, 1]; // start facing +Z
   let lastTime = model.time;

   const sanitizeStick = stick => ({
      x: Number.isFinite(stick?.x) ? stick.x : 0,
      y: Number.isFinite(stick?.y) ? stick.y : 0,
   });

   model.animate(() => {
      const t = model.time;
      const dt = Math.max(0, t - lastTime);
      lastTime = t;

      const left = sanitizeStick(joyStickState.left);
      const right = sanitizeStick(joyStickState.right);

      const magLeft = Math.hypot(left.x, left.y);
      const magRight = Math.hypot(right.x, right.y);

      // Choose whichever joystick is being pushed more.
      const active = magRight >= magLeft ? right : left;
      const mag = Math.max(magLeft, magRight);

      if (mag > deadZone) {
         // Snap input to cardinal directions and allow only 90-degree turns.
         const absX = Math.abs(active.x);
         const absY = Math.abs(active.y);
         const want =
            absX > absY
               ? [Math.sign(active.x) || 1, 0]
               : [0, Math.sign(active.y) || 1];

         const [curDx, curDz] = dir;
         const isPerpendicular = want[0] * curDx + want[1] * curDz === 0;

         if (!isMoving || isPerpendicular) {
            dir = want;
            bike.setHeadingFromDirection(dir[0], dir[1]);
            if (!isMoving)
               isMoving = true;
         }
      }

      if (!isMoving || dt === 0)
         return;

      // Move the bike forward along its heading.
      const distance = speed * dt;
      const forwardX = dir[0];
      const forwardZ = dir[1];

      const [x, y, z] = bike.position;
      let newX = x + forwardX * distance;
      let newZ = z + forwardZ * distance;

      // Compute grid-aligned wall positions in world space.
      const minX = position[0] - half;
      const maxX = position[0] + half;
      const minZ = position[2] - half;
      const maxZ = position[2] + half;

      const hitWall =
         newX < minX + wallMargin || newX > maxX - wallMargin ||
         newZ < minZ + wallMargin || newZ > maxZ - wallMargin;

      if (hitWall) {
         // Respawn at center and wait for next joystick input.
         isMoving = false;
         dir = [0, 1];
         lastTime = t;
         bike.setPosition(position[0], bikeY, position[2]);
         bike.setHeading(0);
         trail.reset(bike);
      }
      else {
         bike.setPosition(newX, y, newZ);
      }

      // Update the Tron-style trail after moving the bike.
      trail.update(bike, t);
   });
}

