/*
   Reusable pizza-box style grid with shallow walls.
*/

let meshId = 0;

export class LightcycleGrid {
   constructor(model, options = {}) {
      this.model = model;
      this.gridSize = options.gridSize ?? 1;
      this.wallHeight = options.wallHeight ?? 0.2;
      this.wallThickness = options.wallThickness ?? 0.1;
      this.gridResolution = options.gridResolution ?? 50;
      this.floorColor = options.floorColor ?? [0.78, 0.7, 0.6];
      this.wallColor = options.wallColor ?? [0.72, 0.63, 0.55];
      this.position = options.position ?? [0, 1.2, 0];

      this.root = model.add();

      const gridName = `lightcycleGrid_${meshId++}`;
      clay.defineMesh(gridName, clay.createGrid(this.gridResolution, this.gridResolution));

      this.floor = this.root.add(gridName);
      this.wallNorth = this.root.add('cube');
      this.wallSouth = this.root.add('cube');
      this.wallEast  = this.root.add('cube');
      this.wallWest  = this.root.add('cube');

      this.update();
   }

   setPosition(x, y, z) {
      this.position = [x, y, z];
      this.update();
      return this;
   }

   update() {
      const { gridSize, wallHeight, wallThickness, floorColor, wallColor } = this;
      const [x, y, z] = this.position;
      const half = gridSize / 2;
      const wallOffset = half + wallThickness / 2;

      this.root.identity().move(x, y, z);

      // Flip winding so the floor is visible from above.
      this.floor.identity().color(floorColor);
      this.floor.setVertices((u, v) => ([
         gridSize * (u - 0.5),
         0.01,
         gridSize * (0.5 - v),
      ]));

      this.wallNorth.identity().color(wallColor)
         .move(0, wallHeight / 2, -wallOffset)
         .scale(half + wallThickness, wallHeight / 2, wallThickness / 2);

      this.wallSouth.identity().color(wallColor)
         .move(0, wallHeight / 2, wallOffset)
         .scale(half + wallThickness, wallHeight / 2, wallThickness / 2);

      this.wallEast.identity().color(wallColor)
         .move(wallOffset, wallHeight / 2, 0)
         .scale(wallThickness / 2, wallHeight / 2, half + wallThickness);

      this.wallWest.identity().color(wallColor)
         .move(-wallOffset, wallHeight / 2, 0)
         .scale(wallThickness / 2, wallHeight / 2, half + wallThickness);
   }
}

