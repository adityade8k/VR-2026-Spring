/*
   Solar system scene (no Three.js).
   Uses the built-in model API to build a sun, orbiting planets, and moons.
*/

export const init = async model => {
   const CONFIG = {
      sun: { radius: 0.55, spinSpeedRange: [0.2, 0.5] },
      planets: {
         countRange: [4, 8],
         radiusRange: [0.08, 0.28],
         orbitRadiusRange: [1.2, 3.6],
         orbitSpeedRange: [0.2, 0.7],
         spinSpeedRange: [0.4, 1.6],
         orbitInclinationRange: [-0.35, 0.35],
         angularOffsetRange: [0, Math.PI * 2],
      },
      moons: {
         countRange: [0, 3],
         radiusRange: [0.02, 0.08],
         orbitRadiusRange: [0.2, 0.6],
         orbitSpeedRange: [0.7, 2.2],
         spinSpeedRange: [0.8, 2.4],
         orbitInclinationRange: [-0.5, 0.5],
         angularOffsetRange: [0, Math.PI * 2],
      },
   };

   const rand = (min, max) => min + Math.random() * (max - min);
   const randInt = (min, max) => Math.floor(rand(min, max + 1));
   const pickRange = ([min, max]) => rand(min, max);

   const pickColor = palette => palette[Math.floor(Math.random() * palette.length)];

   const planetPalette = [
      [0.78, 0.7, 0.55],
      [0.55, 0.7, 0.85],
      [0.7, 0.55, 0.8],
      [0.55, 0.8, 0.62],
      [0.85, 0.55, 0.45],
   ];

   const moonPalette = [
      [0.75, 0.75, 0.78],
      [0.65, 0.66, 0.7],
      [0.78, 0.72, 0.62],
   ];

   const system = model.add();

   const sun = system.add("sphere");

   const anim = {
      sunSpinSpeed: pickRange(CONFIG.sun.spinSpeedRange),
      planets: [],
   };

   const planetCount = randInt(
      CONFIG.planets.countRange[0],
      CONFIG.planets.countRange[1]
   );

   const orbitRadii = Array.from({ length: planetCount }, () =>
      pickRange(CONFIG.planets.orbitRadiusRange)
   ).sort((a, b) => a - b);

   for (let i = 0; i < planetCount; i++) {
      const planetRadius = pickRange(CONFIG.planets.radiusRange);
      const orbitRadius = orbitRadii[i];

      const orbitPivot = system.add();
      const orbitRing = orbitPivot.add("ringY")
         .scale(orbitRadius)
         .color(0.2, 0.25, 0.35)
         .opacity(0.35);

      const planetMesh = orbitPivot.add("sphere");
      const planetData = {
         orbitPivot,
         orbitRing,
         planetMesh,
         orbitRadius,
         orbitSpeed: pickRange(CONFIG.planets.orbitSpeedRange),
         spinSpeed: pickRange(CONFIG.planets.spinSpeedRange),
         tiltX: pickRange(CONFIG.planets.orbitInclinationRange),
         tiltZ: pickRange(CONFIG.planets.orbitInclinationRange),
         angleOffset: pickRange(CONFIG.planets.angularOffsetRange),
         radius: planetRadius,
         color: pickColor(planetPalette),
         moons: [],
      };

      const moonCount = randInt(CONFIG.moons.countRange[0], CONFIG.moons.countRange[1]);
      for (let m = 0; m < moonCount; m++) {
         const moonRadius = Math.min(
            pickRange(CONFIG.moons.radiusRange),
            planetRadius * 0.6
         );

         const moonOrbitRadius = pickRange(CONFIG.moons.orbitRadiusRange);
         const moonPivot = planetMesh.add();
         const moonRing = moonPivot.add("ringY")
            .scale(moonOrbitRadius)
            .color(0.2, 0.25, 0.35)
            .opacity(0.25);

         const moonMesh = moonPivot.add("sphere");

         planetData.moons.push({
            orbitPivot: moonPivot,
            orbitRadius: moonOrbitRadius,
            orbitSpeed: pickRange(CONFIG.moons.orbitSpeedRange),
            spinSpeed: pickRange(CONFIG.moons.spinSpeedRange),
            tiltX: pickRange(CONFIG.moons.orbitInclinationRange),
            tiltZ: pickRange(CONFIG.moons.orbitInclinationRange),
            angleOffset: pickRange(CONFIG.moons.angularOffsetRange),
            radius: moonRadius,
            color: pickColor(moonPalette),
            mesh: moonMesh,
            ring: moonRing,
         });
      }

      anim.planets.push(planetData);
   }

   model.move(0, 1, -1).scale(0.6).animate(() => {
      const t = model.time;

      sun.identity()
         .turnY(t * anim.sunSpinSpeed)
         .scale(CONFIG.sun.radius * (1 + 0.04 * Math.sin(t * 1.6)))
         .color(1.0, 0.75, 0.25);


      for (const planet of anim.planets) {
         planet.orbitPivot.identity()
            .turnX(planet.tiltX)
            .turnZ(planet.tiltZ)
            .turnY(planet.angleOffset + t * planet.orbitSpeed);

         planet.planetMesh.identity()
            .move(planet.orbitRadius, 0, 0)
            .turnY(t * planet.spinSpeed)
            .scale(planet.radius)
            .color(planet.color);

         for (const moon of planet.moons) {
            moon.orbitPivot.identity()
               .turnX(moon.tiltX)
               .turnZ(moon.tiltZ)
               .turnY(moon.angleOffset + t * moon.orbitSpeed);

            moon.mesh.identity()
               .move(moon.orbitRadius, 0, 0)
               .turnY(t * moon.spinSpeed)
               .scale(moon.radius)
               .color(moon.color);
         }
      }
   });
};

