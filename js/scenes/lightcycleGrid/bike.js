/*
   Simple lightcycle bike built from primitive shapes.
*/

export class Bike {
   constructor(model, options = {}) {
      this.model = model;
      this.position = options.position ?? [0, 0, 0];
      this.gridSize = options.gridSize ?? 1;
      // Heading in radians around Y axis. 0 = facing +Z on the grid.
      this.heading = options.heading ?? 0;
      this.scale = options.scale ?? 1;
      this.bodyColor = options.bodyColor ?? [0.15, 0.35, 0.95];
      this.wheelColor = options.wheelColor ?? [0.4, 0.1, 0.8];
      this.accentColor = options.accentColor ?? [0.1, 0.8, 0.1];

      this.root = model.add();
      // Pivot lets us rotate the visual bike mesh independently of its logical heading.
      this.pivot = this.root.add();

      this.frontWheel = this.pivot.add('tubeZ');
      this.rearWheel = this.pivot.add('tubeZ');
      this.body = this.pivot.add('cube');
    //   this.handlebar = this.pivot.add('tubeX');
    //   this.seat = this.pivot.add('tubeX');
      this.core = this.pivot.add('cube');

      this.update();
   }

   setPosition(x, y, z) {
      this.position = [x, y, z];
      this.update();
      return this;
   }

   // Set heading explicitly in radians (rotation about Y axis).
   setHeading(theta) {
      this.heading = theta;
      this.update();
      return this;
   }

   // Convenience: derive heading from a direction vector in the XZ plane.
   // dx, dz are the desired forward direction components on the grid.
   setHeadingFromDirection(dx, dz) {
      if (dx === 0 && dz === 0)
         return this;
      this.heading = Math.atan2(dx, dz);
      this.update();
      return this;
   }

   update() {
      const [x, y, z] = this.position;
      const base = this.gridSize*0.05;
      const wheelRadius = base * 0.16;
      const wheelThickness = base * 0.06;
      const bodyLength = base * 0.7;
      const bodyHeight = base * 0.12;

      // Position the bike on the grid and orient it based on current heading.
      this.root.identity()
         .move(x, y, z)
         .turnY(this.heading)
         .scale(this.scale);

      // Rotate the bike's base orientation by 90 degrees around Y
      // so it visually faces "forward" along the grid.
      this.pivot.identity()
         .turnY(Math.PI / 2);

      this.frontWheel.identity()
         .color(this.wheelColor)
         .move(bodyLength / 2, 0, 0)
         .scale(wheelRadius, wheelRadius, wheelThickness);

      this.rearWheel.identity()
         .color(this.wheelColor)
         .move(-bodyLength / 2, 0, 0)
         .scale(wheelRadius, wheelRadius, wheelThickness);

      this.body.identity()
         .color(this.bodyColor)
         .move(-base*0.1, wheelRadius * 0.55, 0)
         .scale(bodyLength / 5, bodyHeight / 2, wheelThickness / 1.2);

      this.core.identity()
         .color(this.accentColor)
         .move(base*0.1, wheelRadius * 0.85, 0)
         .scale(bodyLength / 5, bodyHeight / 2.5, wheelThickness / 1.6);

    //   this.handlebar.identity()
    //      .color(this.accentColor)
    //      .move(bodyLength / 2 - 0.1, wheelRadius * 1.05, 0)
    //      .scale(0.32, 0.08, 0.08);

    //   this.seat.identity()
    //      .color(this.accentColor)
    //      .move(-bodyLength / 4, wheelRadius * 1.05, 0)
    //      .scale(0.28, 0.08, 0.08);
   }
}

