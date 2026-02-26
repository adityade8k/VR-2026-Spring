import * as cg from "../../render/core/cg.js";
import { loadSound, playSoundAtPosition } from "../../util/positional-audio.js";

// LOAD BOUNCE SOUNDS (same as bouncing.js)
let soundBuffer = [], loadSounds = [];
for (let i = 0; i < 6; i++)
   loadSounds.push(loadSound('../../media/sound/bounce/' + i + '.wav', buffer => soundBuffer[i] = buffer));
Promise.all(loadSounds);

// CONFIGURABLE ROW SETTINGS - rows aligned along Z axis (balls spread in Z)
// position: [x, y] - fixed position for the row (balls move along Z at this x,y)
const ROW_CONFIG = {
   row1: {
      position: [-0.3, 1.6],      // [x, y] - left row
      numBalls: 5,
      spacing: 0.25,
      color: [1, 0.2, 0.2],
      hitColor: [1, 0.6, 0.6]
   },
   row2: {
      position: [0.3, 1.2],       // [x, y] - right row
      numBalls: 5,
      spacing: 0.25,
      color: [0.2, 0.2, 1],
      hitColor: [0.6, 0.6, 1]
   }
};

// BALL MOVEMENT
const START_Z = -2.5;       // balls spawn at this z (behind user)
const THRESHOLD_Z = 0.8;    // balls past this z disappear and respawn at back
const SPEED = 0.8;          // units per second towards user (deltaTime is in seconds)
const BALL_RADIUS = 0.08;
const HIT_RADIUS = 0.15;    // collision detection radius

// Build ball arrays - rows aligned along Z axis (balls spread in Z at fixed x,y)
function buildBalls() {
   let balls = [], ballIndex = 0;
   for (let rowKey of ['row1', 'row2']) {
      let row = ROW_CONFIG[rowKey];
      let n = row.numBalls, s = row.spacing;
      for (let i = 0; i < n; i++) {
         let zOffset = (i - (n - 1) / 2) * s;  // spread balls along Z
         balls.push({
            row: rowKey,
            x: row.position[0],
            y: row.position[1],
            z: START_Z + zOffset,
            phaseOffset: zOffset,  // for wrap to maintain stagger
            hit: 0,
            color: row.color,
            hitColor: row.hitColor
         });
         ballIndex++;
      }
   }
   return balls;
}

export const init = async model => {
   let balls = buildBalls();

   let playSound = i => {
      if (soundBuffer.length > 0 && soundBuffer[0]) {
         let b = balls[i];
         playSoundAtPosition(soundBuffer[6 * Math.random() >> 0], [b.x, b.y, b.z]);
      }
   };

   for (let i = 0; i < balls.length; i++)
      model.add('sphere');

   model.animate(() => {
      let dt = model.deltaTime;  // already in seconds

      // CHECK HITS: hands (finger) or controller (hand matrix position)
      if (typeof clientState !== 'undefined' && typeof clientID !== 'undefined') {
         for (let hand of ['left', 'right']) {
            let pos = clientState.finger(clientID, hand, 1);
            if (!pos && clientState.hand(clientID, hand))
               pos = clientState.hand(clientID, hand).slice(12, 15);
            if (pos) {
               for (let i = 0; i < balls.length; i++) {
                  let b = balls[i];
                  let p = [b.x, b.y, b.z];
                  if (cg.distance(p, pos) < HIT_RADIUS) {
                     balls[i].hit = 10;
                     playSound(i);
                  }
               }
            }
         }
      }

      // MOVE BALLS towards user (+Z)
      for (let i = 0; i < balls.length; i++) {
         balls[i].z += SPEED * dt;
         if (balls[i].z > THRESHOLD_Z)
            balls[i].z = START_Z + balls[i].phaseOffset;
      }

      // RENDER
      for (let i = 0; i < balls.length; i++) {
         let b = balls[i];
         let lit = b.hit-- > 0 ? b.hitColor : b.color;
         model.child(i).color(lit[0], lit[1], lit[2])
            .identity()
            .move(b.x, b.y, b.z)
            .scale(BALL_RADIUS);
      }
   });
}
