/*
   Lightcycle VC scene
   -------------------
   Two lightcycle bikes on a shared LightcycleGrid. Instead of controller input,
   each bike follows a smooth "Perlin walker" path driven by noise, and leaves
   a fading Tron-style trail behind it.
*/

import { LightcycleGrid } from "./LightcycleGrid.js";
import { Bike } from "./bike.js";
import { BikeTrail } from "./biketrail.js";

export const init = async model => {
   // Grid placement and size.
   const position = [0, 1.4, -0.2];
   const gridSize = 1;
   const wallHeight = 0.05;
   const wallThickness = 0.001;

   const grid = new LightcycleGrid(model, {
      position,
      gridSize,
      wallHeight,
      wallThickness,
      floorColor: [0.02, 0.05, 0.08],
      wallColor: [0.1, 0.25, 0.35],
      gridResolution: 50,
   });

   // Keep geometry constants in sync with Bike.update().
   const floorY = position[1] + 0.01;
   const base = gridSize * 0.05;
   const wheelRadius = base * 0.16;
   const bikeY = floorY + wheelRadius;
   const bodyLength = base * 0.7;

   // Two bikes, offset left/right.
   const laneOffset = gridSize * 0.15;

   const bikeA = new Bike(model, {
      position: [position[0] - laneOffset, bikeY, position[2]],
      gridSize,
      bodyColor: [0.15, 0.35, 0.95],
      wheelColor: [0.5, 0.2, 0.9],
      accentColor: [0.1, 0.9, 0.2],
   });

   const bikeB = new Bike(model, {
      position: [position[0] + laneOffset, bikeY, position[2]],
      gridSize,
      bodyColor: [0.95, 0.35, 0.15],
      wheelColor: [0.9, 0.5, 0.2],
      accentColor: [0.2, 0.9, 0.9],
   });

   // Trails for each bike.
   const trailOffset = bodyLength / 2 + wheelRadius;

   const trailA = new BikeTrail(model, {
      gridSize,
      y: floorY + wheelRadius,
      height: wheelRadius * 2,
      thickness: wallThickness * 0.75,
      segmentLength: gridSize * 0.05,
      lifetime: 3,
      color: [0.1, 0.9, 0.2],
      backOffset: trailOffset,
   });

   const trailB = new BikeTrail(model, {
      gridSize,
      y: floorY + wheelRadius,
      height: wheelRadius * 2,
      thickness: wallThickness * 0.75,
      segmentLength: gridSize * 0.05,
      lifetime: 3,
      color: [0.9, 0.2, 0.4],
      backOffset: trailOffset,
   });

   // Grid navigation: bikes drive straight, turn occasionally, and avoid walls.
   const half = gridSize / 2;
   const wallMargin = 0.01;
   const driveSpeed = gridSize * 0.22;
   const trailHitRadius = wheelRadius * 0.8;
   const selfTrailIgnoreAge = 0.2;
   const spawnPadding = gridSize * 0.05;
   const turnMargin = gridSize * 0.06;
   const minTurnInterval = 0.6;
   const maxTurnInterval = 1.8;

   const minX = position[0] - half + wallMargin;
   const maxX = position[0] + half - wallMargin;
   const minZ = position[2] - half + wallMargin;
   const maxZ = position[2] + half - wallMargin;

   const cornerPositions = () => {
      const x0 = position[0] - half + spawnPadding;
      const x1 = position[0] + half - spawnPadding;
      const z0 = position[2] - half + spawnPadding;
      const z1 = position[2] + half - spawnPadding;
      return [
         [x0, z0],
         [x0, z1],
         [x1, z0],
         [x1, z1],
      ];
   };

   const navs = {
      A: { dir: [1, 0], nextTurnTime: 0, cooldownUntil: 0 },
      B: { dir: [-1, 0], nextTurnTime: 0, cooldownUntil: 0 },
   };

   const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
   ];

   const scheduleNextTurn = (nav, time) => {
      nav.nextTurnTime = time + minTurnInterval + Math.random() * (maxTurnInterval - minTurnInterval);
   };

   const setDirection = (bike, nav, dx, dz, time) => {
      nav.dir = [dx, dz];
      bike.setHeadingFromDirection(dx, dz);
      if (typeof time === "number")
         scheduleNextTurn(nav, time);
   };

   const pickDirection = (bike, nav, time, force = false) => {
      if (!force && time < nav.nextTurnTime)
         return;

      const [x, , z] = bike.position;
      const allowed = [];

      for (const [dx, dz] of directions) {
         const probeX = x + dx * turnMargin;
         const probeZ = z + dz * turnMargin;
         if (probeX >= minX + wallMargin && probeX <= maxX - wallMargin &&
             probeZ >= minZ + wallMargin && probeZ <= maxZ - wallMargin) {
            allowed.push([dx, dz]);
         }
      }

      const [curDx, curDz] = nav.dir;
      let candidates = allowed.filter(([dx, dz]) => dx !== -curDx || dz !== -curDz);
      if (candidates.length === 0)
         candidates = allowed.length ? allowed : directions;

      const [dx, dz] = candidates[Math.floor(Math.random() * candidates.length)];
      setDirection(bike, nav, dx, dz, time);
   };

   const cornerPairs = [
      [0, 3],
      [1, 2],
   ];
   let cornerPairIndex = 0;

   const placeAtCornerPair = () => {
      const corners = cornerPositions();
      const [aIdx, bIdx] = cornerPairs[cornerPairIndex % cornerPairs.length];
      cornerPairIndex++;
      return [
         corners[aIdx][0], corners[aIdx][1],
         corners[bIdx][0], corners[bIdx][1],
      ];
   };

   // Initialize at corners and set walker seeds.
   const [ax, az, bx, bz] = placeAtCornerPair();
   bikeA.setPosition(ax, bikeY, az);
   bikeB.setPosition(bx, bikeY, bz);
   trailA.reset(bikeA);
   trailB.reset(bikeB);
   setDirection(bikeA, navs.A, 1, 0, model.time);
   setDirection(bikeB, navs.B, -1, 0, model.time);

   let lastTime = model.time;

   model.animate(() => {
      const t = model.time;
      const dt = Math.max(0, t - lastTime);
      lastTime = t;

      const respawn = (bike, trail, nav, time) => {
         const [ax, az, bx, bz] = placeAtCornerPair();
         const x = bike === bikeA ? ax : bx;
         const z = bike === bikeA ? az : bz;
         bike.setPosition(x, bikeY, z);
         bike.setHeading(0);
         trail.reset(bike);
         nav.cooldownUntil = time + 0.35;
         pickDirection(bike, nav, time, true);
      };

      const updateBike = (bike, trail, nav) => {
         const [x, y, z] = bike.position;

         pickDirection(bike, nav, t);

         const [dx, dz] = nav.dir;
         let newX = x + dx * driveSpeed * dt;
         let newZ = z + dz * driveSpeed * dt;

         let hitWall = false;
         if (newX < minX + wallMargin || newX > maxX - wallMargin ||
             newZ < minZ + wallMargin || newZ > maxZ - wallMargin) {
            hitWall = true;
            newX = Math.min(maxX - wallMargin, Math.max(minX + wallMargin, newX));
            newZ = Math.min(maxZ - wallMargin, Math.max(minZ + wallMargin, newZ));
         }

         if (hitWall)
            pickDirection(bike, nav, t, true);

         if (t >= nav.cooldownUntil &&
             typeof trailA.isPointNear === "function" &&
             typeof trailB.isPointNear === "function") {
            const hitTrail =
               trailA.isPointNear(newX, newZ, t, bike === bikeA ? selfTrailIgnoreAge : 0, trailHitRadius) ||
               trailB.isPointNear(newX, newZ, t, bike === bikeB ? selfTrailIgnoreAge : 0, trailHitRadius);

            if (hitTrail) {
               respawn(bike, trail, nav, t);
               return;
            }
         }

         bike.setPosition(newX, y, newZ);
         trail.update(bike, t);
      };

      updateBike(bikeA, trailA, navs.A);
      updateBike(bikeB, trailB, navs.B);
   });
};


