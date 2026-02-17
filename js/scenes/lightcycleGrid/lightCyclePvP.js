/*
   Lightcycle PvP
   -------------
   Multiplayer lightcycle game using shared state and joystick input.
*/

import { LightcycleGrid } from "./LightcycleGrid.js";
import { Bike } from "./bike.js";
import { BikeTrail } from "./biketrail.js";
import { joyStickState } from "../../render/core/controllerInput.js";

export const init = async model => {
   // Grid placement and size.
   const position = [0, 1.4, -0.2];
   const gridSize = 1;
   const wallHeight = 0.05;
   const wallThickness = 0.001;

   new LightcycleGrid(model, {
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

   const trailOffset = bodyLength / 2 + wheelRadius;

   // Gameplay tuning.
   const half = gridSize / 2;
   const wallMargin = 0.01;
   const speed = gridSize * 0.2;
   const smoothTime = 0.08;
   const deadZone = 0.25;
   const trailHitRadius = wheelRadius * 0.9;
   const selfTrailIgnoreAge = 0.25;
   const spawnPadding = gridSize * 0.08;

   const minX = position[0] - half;
   const maxX = position[0] + half;
   const minZ = position[2] - half;
   const maxZ = position[2] + half;

   const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
   ];

   const stateKey = "lightCyclePvPState";
   const inputKey = "lightCyclePvPInput";

   if (window[stateKey] === undefined)
      window[stateKey] = { bikes: {} };
   if (window[inputKey] === undefined)
      window[inputKey] = {};

   const palette = [
      { body: [0.15, 0.35, 0.95], wheel: [0.5, 0.2, 0.9], accent: [0.1, 0.9, 0.2], trail: [0.1, 0.9, 0.2] },
      { body: [0.95, 0.35, 0.15], wheel: [0.9, 0.5, 0.2], accent: [0.2, 0.9, 0.9], trail: [0.9, 0.2, 0.4] },
      { body: [0.2, 0.8, 0.4], wheel: [0.15, 0.6, 0.3], accent: [0.9, 0.9, 0.2], trail: [0.2, 0.8, 0.4] },
      { body: [0.75, 0.25, 0.8], wheel: [0.6, 0.2, 0.7], accent: [0.2, 0.9, 0.6], trail: [0.75, 0.25, 0.8] },
   ];

   const localBikes = new Map();

   const pickPalette = id => palette[Math.abs(parseInt(id, 10) || 0) % palette.length];

   const createLocalBike = id => {
      const colors = pickPalette(id);
      const bike = new Bike(model, {
         position: [position[0], bikeY, position[2]],
         gridSize,
         bodyColor: colors.body,
         wheelColor: colors.wheel,
         accentColor: colors.accent,
      });

      const trail = new BikeTrail(model, {
         gridSize,
         y: floorY + wheelRadius,
         height: wheelRadius * 2,
         thickness: wallThickness * 0.75,
         segmentLength: gridSize * 0.05,
         lifetime: 6,
         color: colors.trail,
         backOffset: trailOffset,
      });

      localBikes.set(String(id), { bike, trail, spawnId: -1 });
      return localBikes.get(String(id));
   };

   const ensureLocalBike = id => localBikes.get(String(id)) ?? createLocalBike(id);
   const removeLocalBike = id => {
      const key = String(id);
      const local = localBikes.get(key);
      if (!local)
         return;
      local.trail.reset();
      local.trail.root.identity().scale(0, 0, 0);
      local.bike.root.identity().scale(0, 0, 0);
      localBikes.delete(key);
   };

   const randomSpawn = () => {
      const x = minX + spawnPadding + Math.random() * (maxX - minX - spawnPadding * 2);
      const z = minZ + spawnPadding + Math.random() * (maxZ - minZ - spawnPadding * 2);
      return [x, z];
   };

   const randomDir = () => directions[Math.floor(Math.random() * directions.length)];

   const applyRespawn = (state, id) => {
      const [x, z] = randomSpawn();
      const dir = randomDir();
      const prev = state.bikes[id];
      const spawnId = (prev?.spawnId ?? 0) + 1;

      state.bikes[id] = { x, z, dir, spawnId };

      const local = ensureLocalBike(id);
      local.bike.setPosition(x, bikeY, z);
      local.bike.setHeadingFromDirection(dir[0], dir[1]);
      local.trail.reset(local.bike);
      local.spawnId = spawnId;
   };

   const updateLocalFromState = (id, info, dt, canSmooth) => {
      const local = ensureLocalBike(id);
      const didRespawn = local.spawnId !== info.spawnId;
      if (didRespawn) {
         local.renderPos = [info.x, info.z];
         local.bike.setPosition(info.x, bikeY, info.z);
         local.trail.reset(local.bike);
         local.spawnId = info.spawnId;
      }

      if (!canSmooth || didRespawn) {
         local.bike.setPosition(info.x, bikeY, info.z);
         local.renderPos = [info.x, info.z];
      }
      else {
         if (!local.renderPos)
            local.renderPos = [info.x, info.z];
         const alpha = 1 - Math.exp(-dt / Math.max(0.001, smoothTime));
         local.renderPos[0] += (info.x - local.renderPos[0]) * alpha;
         local.renderPos[1] += (info.z - local.renderPos[1]) * alpha;
         local.bike.setPosition(local.renderPos[0], bikeY, local.renderPos[1]);
      }
      local.bike.setHeadingFromDirection(info.dir[0], info.dir[1]);
   };

   const pickInputDirection = () => {
      const left = joyStickState.left || { x: 0, y: 0 };
      const right = joyStickState.right || { x: 0, y: 0 };

      const magLeft = Math.hypot(left.x, left.y);
      const magRight = Math.hypot(right.x, right.y);
      const active = magRight > magLeft ? right : left;
      const mag = Math.max(magLeft, magRight);

      if (mag <= deadZone)
         return null;

      const absX = Math.abs(active.x);
      const absY = Math.abs(active.y);
      return absX > absY
         ? [Math.sign(active.x) || 1, 0]
         : [0, Math.sign(active.y) || 1];
   };

   const isPerpendicular = (a, b) => a[0] * b[0] + a[1] * b[1] === 0;

   const hitWall = (x, z) =>
      x < minX + wallMargin || x > maxX - wallMargin ||
      z < minZ + wallMargin || z > maxZ - wallMargin;

   const hitTrail = (selfId, x, z, time) => {
      for (const [id, entry] of localBikes.entries()) {
         const minAge = id === String(selfId) ? selfTrailIgnoreAge : 0;
         if (entry.trail.isPointNear(x, z, time, minAge, trailHitRadius))
            return true;
      }
      return false;
   };

   let lastInputDir = null;
   let lastTime = model.time;

   model.animate(() => {
      const t = model.time;
      const dt = Math.max(0, t - lastTime);
      lastTime = t;

      const canUseMaster =
         typeof isMasterClient === "function" &&
         typeof clients !== "undefined";
      const isMaster = canUseMaster && isMasterClient();
      const isXRClient = window.clientID !== undefined &&
         clientState?.isXR &&
         clientState.isXR(clientID);
      const isClientXR = id =>
         clientState?.isXR && clientState.isXR(Number(id));

      // Prefer simulating on the first XR client. If none, fall back to master.
      let simulatorId = null;
      if (typeof clients !== "undefined" && clients.length) {
         for (const id of clients) {
            if (clientState?.isXR && clientState.isXR(id)) {
               simulatorId = String(id);
               break;
            }
         }
      }
      if (!simulatorId && isXRClient)
         simulatorId = String(clientID);
      if (!simulatorId && isMaster && window.clientID !== undefined)
         simulatorId = String(clientID);

      const isSimulator = simulatorId !== null &&
         window.clientID !== undefined &&
         String(clientID) === simulatorId;

      // Emit local joystick turns to the server (XR-only).
      if (window.clientID !== undefined && isXRClient) {
         const want = pickInputDirection();
         if (want && (!lastInputDir || want[0] !== lastInputDir[0] || want[1] !== lastInputDir[1])) {
            window[inputKey][clientID] = { dir: want, time: t };
            server.broadcastGlobal(inputKey);
            lastInputDir = want;
         }
      }

      if (isSimulator)
         window[inputKey] = server.synchronize(inputKey) || window[inputKey];
      if (!isSimulator)
         window[stateKey] = server.synchronize(stateKey) || window[stateKey];

      const state = window[stateKey];
      const inputs = window[inputKey];

      if (isSimulator) {
         const connectedIds = new Set();
         if (typeof clients !== "undefined" && clients.length) {
            for (const id of clients)
               connectedIds.add(String(id));
         }
         if (!connectedIds.size && window.clientID !== undefined)
            connectedIds.add(String(clientID));

         for (const id of connectedIds) {
            if (!state.bikes[id])
               applyRespawn(state, id);
         }

         // Remove bikes for clients that have disconnected.
         for (const id in state.bikes) {
            if (!connectedIds.has(String(id)))
               delete state.bikes[id];
         }

         for (const id in state.bikes) {
            const bikeState = state.bikes[id];
            const input = inputs[id];

            if (isClientXR(id) && input && input.dir && isPerpendicular(input.dir, bikeState.dir))
               bikeState.dir = input.dir;

            const [dx, dz] = bikeState.dir;
            let newX = bikeState.x;
            let newZ = bikeState.z;
            if (isClientXR(id)) {
               newX += dx * speed * dt;
               newZ += dz * speed * dt;
            }

            ensureLocalBike(id);

            if (isClientXR(id) && (hitWall(newX, newZ) || hitTrail(id, newX, newZ, t))) {
               applyRespawn(state, id);
               continue;
            }

            bikeState.x = newX;
            bikeState.z = newZ;
         }

         server.broadcastGlobal(stateKey);
      }

      const activeStateIds = new Set(Object.keys(state.bikes).map(String));
      for (const id of localBikes.keys()) {
         if (!activeStateIds.has(id))
            removeLocalBike(id);
      }

      for (const id in state.bikes) {
         const info = state.bikes[id];
         updateLocalFromState(id, info, dt, !isSimulator);
         const local = ensureLocalBike(id);
         local.trail.update(local.bike, t);
      }
   });
};

