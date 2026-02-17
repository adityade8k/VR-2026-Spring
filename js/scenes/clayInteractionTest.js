import * as cg from "../render/core/cg.js";
import { controllerMatrix } from "../render/core/controllerInput.js";

export const init = async model => {
// Load a texture into slot 1
model.txtrSrc(1, '../media/textures/brick.png');

// Create a sphere using clay's built-in geometry
let sphere = model.add("diskZ");

// Position and style the sphere
const pos = { x: 0, y: 1.5, z: -1 };
const sphereScale = 0.5;

sphere.move(pos.x, pos.y, pos.z)
.scale(sphereScale)
.txtr(1);

// Animate ripples by deforming vertices (similar to flag.js pattern)
model.animate(() => {
   const t = model.time;
   const toRoot = p => window.clay?.inverseRootMatrix
      ? cg.mTransform(window.clay.inverseRootMatrix, p)
      : p;
   const leftPos = controllerMatrix.left?.length ? toRoot(controllerMatrix.left.slice(12, 15)) : null;
   const rightPos = controllerMatrix.right?.length ? toRoot(controllerMatrix.right.slice(12, 15)) : null;
   const controllerLocal = [];

   const toLocal = p => ([
      (p[0] - pos.x) / sphereScale,
      (p[1] - pos.y) / sphereScale,
      (p[2] - pos.z) / sphereScale,
   ]);

   if (leftPos) controllerLocal.push(toLocal(leftPos));
   if (rightPos) controllerLocal.push(toLocal(rightPos));
   sphere.setVertices((u, v) => {
      // Convert uv -> xyz, then deform in xyz space
      const theta = 2 * Math.PI * u;
      const phi = Math.PI * (v - 0.5);
      const base = [
         Math.cos(phi) * Math.cos(theta),
         Math.sin(phi),
         Math.cos(phi) * Math.sin(theta)
      ];
      const ripple = 0.02 * Math.sin(6 * (base[0] + base[1] + base[2]) + t * 3);
      const noise = 0.05 * cg.noise(3 * base[0] + t, 3 * base[1], 3 * base[2]);

      let proximity = 0;
      for (let i = 0; i < controllerLocal.length; i++) {
         const c = controllerLocal[i];
         const dx = base[0] - c[0];
         const dy = base[1] - c[1];
         const dz = base[2] - c[2];
         const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
         proximity = Math.max(proximity, Math.exp(-d * 2));
      }

      const touchRipple = 0.35 * proximity * Math.sin(10 * (base[0] + base[1]) - t * 6);
      const r = 1 + ripple + noise + touchRipple;
      return [base[0] * r, base[1] * r, base[2] * r];
   });
});
}