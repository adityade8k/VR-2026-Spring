/*
   Lightcycle PvP
   -------------
   Multiplayer lightcycle game using shared state and joystick input.
*/

import { LightcycleGrid } from "./LightcycleGrid.js";
import { Bike } from "./bike.js";
import { BikeTrail } from "./biketrail.js";
import { joyStickState, buttonState } from "../../render/core/controllerInput.js";

const TWEAKS = {
   grid: {
      position: [0, 1.4, -0.2],
      size: 1,
      wallHeight: 0.05,
      wallThickness: 0.001,
      floorColor: [0.02, 0.05, 0.08],
      wallColor: [0.1, 0.25, 0.35],
      resolution: 50,
   },
   bike: {
      baseRatio: 0.05,
      wheelRadiusRatio: 0.16,
      bodyLengthRatio: 0.7,
   },
   gameplay: {
      wallMargin: 0.01,
      speedRatio: 0.2,
      smoothTime: 0.08,
      deadZone: 0.25,
      trailHitRadiusRatio: 0.9,
      selfTrailIgnoreAge: 0.25,
      spawnPaddingRatio: 0.08,
   },
   trail: {
      thicknessRatio: 0.75,
      segmentLengthRatio: 0.05,
      lifetimeBase: 1,
      lifetimeIncrement: 1,
   },
   gridControl: {
      moveDeadZone: 0.2,
      moveSpeedRatio: 0.35,
      liftSpeedRatio: 0.5,
   },
   instructions: {
      offset: [-0.16, 0.08, 0.1],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [0.7, 0.7, 0.7],
      panelSize: [0.20, 0.12],
      textScale: 0.85,
      panelColor: [0, 0, 0],
      panelOpacity: 1,
      textColor: [0.95, 0.95, 0.95],
   },
   deathsLocal: {
      offset: [-0.10, 0.08, 0.1],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [0.7, 0.7, 0.7],
      panelSize: [0.14, 0.08],
      textScale: 1.5,
      stackStep: 0.14,
      panelColor: [0, 0, 0],
      panelOpacity: 1,
      textColor: [0.95, 0.95, 0.95],
   },
   deathsOther: {
      offset: [-0.10, 0.08, -0.1],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [0.7, 0.7, 0.7],
      panelSize: [0.14, 0.08],
      textScale: 1.5,
      stackStep: 0.14,
      panelColor: [0, 0, 0],
      panelOpacity: 1,
      textColor: [0.95, 0.95, 0.95],
   },
};

export const init = async model => {
   // Grid placement and size.
   const basePosition = TWEAKS.grid.position;
   const gridSize = TWEAKS.grid.size;
   const wallHeight = TWEAKS.grid.wallHeight;
   const wallThickness = TWEAKS.grid.wallThickness;

   const grid = new LightcycleGrid(model, {
      position: basePosition,
      gridSize,
      wallHeight,
      wallThickness,
      floorColor: TWEAKS.grid.floorColor,
      wallColor: TWEAKS.grid.wallColor,
      gridResolution: TWEAKS.grid.resolution,
   });

   // Keep geometry constants in sync with Bike.update().
   let gridPosition = basePosition.slice();
   let floorY = basePosition[1] + 0.01;
   const base = gridSize * TWEAKS.bike.baseRatio;
   const wheelRadius = base * TWEAKS.bike.wheelRadiusRatio;
   let bikeY = floorY + wheelRadius;
   const bodyLength = base * TWEAKS.bike.bodyLengthRatio;

   const trailOffset = bodyLength / 2 + wheelRadius;

   // Gameplay tuning.
   const half = gridSize / 2;
   const wallMargin = TWEAKS.gameplay.wallMargin;
   const speed = gridSize * TWEAKS.gameplay.speedRatio;
   const smoothTime = TWEAKS.gameplay.smoothTime;
   const deadZone = TWEAKS.gameplay.deadZone;
   const trailHitRadius = wheelRadius * TWEAKS.gameplay.trailHitRadiusRatio;
   const selfTrailIgnoreAge = TWEAKS.gameplay.selfTrailIgnoreAge;
   const spawnPadding = gridSize * TWEAKS.gameplay.spawnPaddingRatio;
   const trailLifetimeBase = TWEAKS.trail.lifetimeBase;
   const trailLifetimeIncrement = TWEAKS.trail.lifetimeIncrement;

   let minX = basePosition[0] - half;
   let maxX = basePosition[0] + half;
   let minZ = basePosition[2] - half;
   let maxZ = basePosition[2] + half;

   const instructionText = clay.text(
      "INPUTS\n" +
      
      "Left Stick: move grid around\n" +
      "Left Trigger: move grid down\n" +
      "Left Grip: move grid up\n" +
      "\n" +
      "Right Stick: turn bike\n" +
      "Let stick go to neutral\n" +
      "to move again after respawn"
   );
   const instructionRoot = model.add();
   const instructionBackground = instructionRoot.add("square")
      .color(...TWEAKS.instructions.panelColor)
      .opacity(TWEAKS.instructions.panelOpacity);
   const instructionLabel = instructionRoot.add(instructionText)
      .color(...TWEAKS.instructions.textColor);

   const getDeathText = count => `DEATHS\n${count}`;
   const deathPanels = new Map();

   const updateBounds = () => {
      minX = basePosition[0] - half;
      maxX = basePosition[0] + half;
      minZ = basePosition[2] - half;
      maxZ = basePosition[2] + half;
   };

   const updateHeights = () => {
      floorY = basePosition[1] + 0.01;
      bikeY = floorY + wheelRadius;
   };

   const updateInstructionPanel = () => {
      const { offset, rotation, scale, panelSize, textScale } = TWEAKS.instructions;
      const panelX = gridPosition[0] + half + offset[0];
      const panelY = gridPosition[1] + offset[1];
      const panelZ = gridPosition[2] + half + offset[2];

      instructionRoot.identity()
         .move(panelX, panelY, panelZ)
         .turnX(rotation[0])
         .turnY(rotation[1])
         .turnZ(rotation[2])
         .scale(scale[0], scale[1], scale[2]);

      instructionBackground.identity()
         .scale(panelSize[0], panelSize[1], 1);

      instructionLabel.identity()
         .move(-panelSize[0] * 0.9, panelSize[1] * 0.75, 0.01)
         .scale(textScale);
   };

   const createDeathPanel = config => {
      const root = model.add();
      const background = root.add("square")
         .opacity(config.panelOpacity);
      const label = root.add(clay.text(getDeathText(0)));
      return { root, background, label, lastCount: 0 };
   };

   const updateDeathPanel = (id, count, colors, index, config) => {
      let panel = deathPanels.get(id);
      if (!panel) {
         panel = createDeathPanel(config);
         deathPanels.set(id, panel);
      }

      if (count !== panel.lastCount) {
         panel.lastCount = count;
         if (panel.root.nChildren() > 1)
            panel.root.remove(1);
         panel.label = panel.root.add(clay.text(getDeathText(count)));
      }

      const panelColor = colors?.body ?? config.panelColor;
      const textColor = colors?.trail ?? config.textColor;
      panel.background
         .color(...panelColor);
      panel.label
         .color(...textColor);

      const { offset, rotation, scale, panelSize, textScale, stackStep } = config;
      const panelX = gridPosition[0] - half + offset[0];
      const panelY = gridPosition[1] + offset[1];
      const panelZ = gridPosition[2] + half + offset[2] - index * stackStep;

      panel.root.identity()
         .move(panelX, panelY, panelZ)
         .turnX(rotation[0])
         .turnY(rotation[1])
         .turnZ(rotation[2])
         .scale(scale[0], scale[1], scale[2]);

      panel.background.identity()
         .scale(panelSize[0], panelSize[1], 1);

      panel.label.identity()
         .move(-panelSize[0] * 0.7, panelSize[1] * 0.45, 0.01)
         .scale(textScale);
   };

   const updateDeathPanels = (activeIds, localId, state) => {
      const orderedIds = Array.from(activeIds).sort();
      const localIndex = orderedIds.indexOf(String(localId));
      if (localIndex > 0)
         orderedIds.unshift(orderedIds.splice(localIndex, 1)[0]);

      orderedIds.forEach((id, index) => {
         const local = ensureLocalBike(id);
         const colors = local.colors ?? pickPalette(id);
         const info = state.bikes[id];
         const spawnId = info?.spawnId ?? 0;
         const count = Math.max(0, spawnId - 1);
         const config = String(id) === String(localId)
            ? TWEAKS.deathsLocal
            : TWEAKS.deathsOther;
         updateDeathPanel(String(id), count, colors, index, config);
      });

      for (const id of deathPanels.keys()) {
         if (!activeIds.has(id)) {
            const panel = deathPanels.get(id);
            if (panel)
               panel.root.identity().scale(0, 0, 0);
            deathPanels.delete(id);
         }
      }
   };

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

   const getTrailLifetime = trailLevel =>
      trailLifetimeBase + trailLevel * trailLifetimeIncrement;

   const createLocalBike = id => {
      const colors = pickPalette(id);
      const bikeRoot = model.add();
      const trailRoot = model.add();
      const bike = new Bike(bikeRoot, {
         position: [basePosition[0], bikeY, basePosition[2]],
         gridSize,
         bodyColor: colors.body,
         wheelColor: colors.wheel,
         accentColor: colors.accent,
      });

      const trail = new BikeTrail(trailRoot, {
         gridSize,
         y: floorY + wheelRadius,
         height: wheelRadius * 2,
         thickness: wallThickness * TWEAKS.trail.thicknessRatio,
         segmentLength: gridSize * TWEAKS.trail.segmentLengthRatio,
         lifetime: trailLifetimeBase,
         color: colors.trail,
         backOffset: trailOffset,
      });

      localBikes.set(String(id), {
         bike,
         trail,
         spawnId: -1,
         trailLevel: 0,
         bikeRoot,
         trailRoot,
         deathCount: 0,
         hasSpawned: false,
         colors,
      });
      return localBikes.get(String(id));
   };

   const ensureLocalBike = id => localBikes.get(String(id)) ?? createLocalBike(id);
   const removeLocalBike = id => {
      const key = String(id);
      const local = localBikes.get(key);
      if (!local)
         return;
      local.trail.reset();
      local.trailRoot.identity().scale(0, 0, 0);
      local.bikeRoot.identity().scale(0, 0, 0);
      const panel = deathPanels.get(key);
      if (panel) {
         panel.root.identity().scale(0, 0, 0);
         deathPanels.delete(key);
      }
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
      const trailLevel = prev ? (prev.trailLevel ?? 0) + 1 : 0;

      state.bikes[id] = {
         x,
         z,
         dir,
         spawnId,
         isMoving: false,
         needsNeutral: true,
         trailLevel,
      };

      const local = ensureLocalBike(id);
      local.trailLevel = trailLevel;
      local.trail.lifetime = getTrailLifetime(trailLevel);
      local.bike.setPosition(x, bikeY, z);
      local.bike.setHeadingFromDirection(dir[0], dir[1]);
      local.trail.reset(local.bike);
      local.spawnId = spawnId;
   };

   const updateLocalFromState = (id, info, dt, canSmooth) => {
      const local = ensureLocalBike(id);
      const didRespawn = local.spawnId !== info.spawnId;
      if (didRespawn) {
         if (local.hasSpawned)
            local.deathCount += 1;
         else
            local.hasSpawned = true;
         local.renderPos = [info.x, info.z];
         if (info.trailLevel !== undefined) {
            local.trailLevel = info.trailLevel;
            local.trail.lifetime = getTrailLifetime(info.trailLevel);
         }
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
      const right = joyStickState.right || { x: 0, y: 0 };
      const mag = Math.hypot(right.x, right.y);

      if (mag <= deadZone)
         return null;

      const absX = Math.abs(right.x);
      const absY = Math.abs(right.y);
      return absX > absY
         ? [Math.sign(right.x) || 1, 0]
         : [0, Math.sign(right.y) || 1];
   };

   const isPerpendicular = (a, b) => a[0] * b[0] + a[1] * b[1] === 0;

   const sameInputDir = (a, b) => {
      if (!a && !b)
         return true;
      if (!a || !b)
         return false;
      return a[0] === b[0] && a[1] === b[1];
   };

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
   let renderOffset = [0, 0, 0];
   const gridMoveDeadZone = TWEAKS.gridControl.moveDeadZone;
   const gridMoveSpeed = gridSize * TWEAKS.gridControl.moveSpeedRatio;
   const gridLiftSpeed = gridSize * TWEAKS.gridControl.liftSpeedRatio;

   model.animate(() => {
      const t = model.time;
      const dt = Math.max(0, t - lastTime);
      lastTime = t;

      const hasClients =
         typeof clients !== "undefined" &&
         Array.isArray(clients) &&
         clients.length > 0;
      const localId = window.clientID !== undefined ? String(clientID) : "local";
      const isMaster = hasClients ? clientID == clients[0] : true;
      const hasClientState =
         typeof clientState !== "undefined" &&
         clientState &&
         typeof clientState.isXR === "function";
      const isXRClient = window.clientID !== undefined &&
         hasClientState &&
         clientState.isXR(clientID);
      const isClientXR = id =>
         hasClientState && clientState.isXR(Number(id));

      // Emit local right-joystick turns to the server (XR-only).
      if (window.clientID !== undefined && isXRClient) {
         const want = pickInputDirection();
         if (!sameInputDir(want, lastInputDir)) {
            window[inputKey][clientID] = { dir: want, time: t };
            server.broadcastGlobal(inputKey);
            lastInputDir = want;
         }
      }

      window[inputKey] = server.synchronize(inputKey) || window[inputKey];
      window[stateKey] = server.synchronize(stateKey) || window[stateKey];

      const state = window[stateKey];
      const inputs = window[inputKey];
      if (isXRClient) {
         const leftStick = joyStickState.left || { x: 0, y: 0 };
         const leftButtons = buttonState.left || [];
         const leftTrigger = !!leftButtons[0]?.pressed;
         const leftGrip = !!leftButtons[1]?.pressed || !!leftButtons[2]?.pressed;

         const moveX = Math.abs(leftStick.x) > gridMoveDeadZone ? leftStick.x : 0;
         const moveZ = Math.abs(leftStick.y) > gridMoveDeadZone ? leftStick.y : 0;
         const moveY = leftGrip === leftTrigger ? 0 : (leftGrip ? 1 : -1);

         renderOffset[0] += moveX * gridMoveSpeed * dt;
         renderOffset[1] += moveY * gridLiftSpeed * dt;
         renderOffset[2] += moveZ * gridMoveSpeed * dt;

         gridPosition = [
            basePosition[0] + renderOffset[0],
            basePosition[1] + renderOffset[1],
            basePosition[2] + renderOffset[2],
         ];
         grid.setPosition(gridPosition[0], gridPosition[1], gridPosition[2]);
      }

      updateInstructionPanel();

      if (isMaster) {
         const connectedIds = new Set();
         if (hasClients) {
            for (const id of clients)
               connectedIds.add(String(id));
         }
         else {
            connectedIds.add(localId);
         }

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
            if (bikeState.isMoving === undefined)
               bikeState.isMoving = true;
            if (bikeState.needsNeutral === undefined)
               bikeState.needsNeutral = false;

            if (isClientXR(id)) {
               const inputDir = input ? input.dir : null;
               if (bikeState.needsNeutral) {
                  if (!inputDir)
                     bikeState.needsNeutral = false;
               }
               else if (inputDir) {
                  if (!bikeState.isMoving)
                     bikeState.isMoving = true;
                  if (isPerpendicular(inputDir, bikeState.dir))
                     bikeState.dir = inputDir;
               }
            }

            const [dx, dz] = bikeState.dir;
            let newX = bikeState.x;
            let newZ = bikeState.z;
            if (isClientXR(id) && bikeState.isMoving) {
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
         updateLocalFromState(id, info, dt, !isMaster);
         const local = ensureLocalBike(id);
         local.bikeRoot.identity().move(renderOffset[0], renderOffset[1], renderOffset[2]);
         local.trailRoot.identity().move(renderOffset[0], renderOffset[1], renderOffset[2]);
         local.trail.update(local.bike, t);
      }

      updateDeathPanels(activeStateIds, localId, state);
   });
};

