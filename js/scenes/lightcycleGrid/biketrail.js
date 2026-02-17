/*
   BikeTrail
   ---------
   Helper that leaves a Tron-style trail behind a bike moving on the LightcycleGrid.

   Features:
   - Configurable trail height and thickness.
   - Renders the trail as a series of straight segments (cubes).
   - Granularity control via segmentLength (how far the bike moves between segments).
   - Each segment has a limited lifetime and disappears after a while.
*/

export class BikeTrail {
   constructor(model, options = {}) {
      this.model = model;

      // GRID / WORLD CONFIG
      this.gridSize       = options.gridSize       ?? 1;
      this.y              = options.y              ?? 0;     // vertical center of the trail in world space

      // TRAIL APPEARANCE
      this.height         = options.height         ?? 0.02;  // vertical height of each trail segment
      this.thickness      = options.thickness      ?? 0.003; // width of each trail segment in XZ
      this.color          = options.color          ?? [0.1, 0.9, 0.2];

      // BEHAVIOR
      this.segmentLength  = options.segmentLength  ?? (this.gridSize * 0.02); // distance between trail samples
      this.lifetime       = options.lifetime       ?? 6;     // seconds a segment stays visible
      this.backOffset     = options.backOffset     ?? 0;     // how far behind the bike the trail is drawn

      // Root node for all trail geometry.
      this.root = model.add();

      // Internal state
      this.segments = [];    // { node, birth, length, from, to }
      this.lastPoint = null; // [x, y, z]
   }

   // Clear all existing segments and optionally snap the trail start to the bike.
   reset(bike = null) {
      for (const seg of this.segments) {
         // Hide old segments by collapsing them.
         seg.node.identity().scale(0, 0, 0);
      }
      this.segments = [];

      if (bike) {
         const [x, , z] = bike.position;
         this.lastPoint = [x, this.y, z];
      }
      else {
         this.lastPoint = null;
      }
   }

   // Call once per frame from the scene's animate loop.
   // Expects: a Bike instance (with .position and .heading) and the current time in seconds.
   update(bike, time) {
      const [bx, , bz] = bike.position;

      // Optionally offset the start point so the trail is drawn behind the bike.
      let px = bx;
      let pz = bz;
      if (this.backOffset) {
         const backX = Math.sin(bike.heading) * this.backOffset;
         const backZ = Math.cos(bike.heading) * this.backOffset;
         px -= backX;
         pz -= backZ;
      }

      const current = [px, this.y, pz];

      // First call: just record the starting point, no segment yet.
      if (!this.lastPoint) {
         this.lastPoint = current;
      }
      else {
         const [lx, ly, lz] = this.lastPoint;
         const dx = bx - lx;
         const dz = bz - lz;
         const dist = Math.hypot(dx, dz);

         // Once we've moved far enough, drop a segment from lastPoint to current.
         if (dist >= this.segmentLength) {
            this._addSegment([lx, ly, lz], current, time);
            this.lastPoint = current;
         }
      }

      // Age out old segments.
      const stillAlive = [];
      for (const seg of this.segments) {
         const age = time - seg.birth;
         if (age >= this.lifetime) {
            // Collapse segment to effectively remove it.
            seg.node.identity().scale(0, 0, 0);
         }
         else {
            stillAlive.push(seg);
         }
      }
      this.segments = stillAlive;
   }

   // Check if a point in XZ space is near any trail segment.
   isPointNear(x, z, time, minAge = 0, extraRadius = 0) {
      const radius = this.thickness / 2 + extraRadius;
      const radiusSq = radius * radius;
      for (const seg of this.segments) {
         if (time - seg.birth < minAge)
            continue;
         if (this._distanceSqToSegment(x, z, seg.from, seg.to) <= radiusSq)
            return true;
      }
      return false;
   }

   _addSegment(from, to, birth) {
      const [x0, y0, z0] = from;
      const [x1, y1, z1] = to;

      const dx = x1 - x0;
      const dz = z1 - z0;
      const length = Math.hypot(dx, dz);
      if (length === 0)
         return;

      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;
      const midZ = (z0 + z1) / 2;

      // Orientation in XZ plane (rotated by 90 degrees to match bike visuals).
      const yaw = Math.atan2(dx, dz) + Math.PI / 2;

      const node = this.root.add('cube');
      node.identity()
         .color(this.color)
         .move(midX, midY, midZ)
         .turnY(yaw)
         // scale: length along local X, height on Y, thickness on Z.
         .scale(length / 2, this.height / 2, this.thickness / 2);

      this.segments.push({
         node,
         birth,
         length,
         from: [x0, z0],
         to: [x1, z1],
      });
   }

   _distanceSqToSegment(px, pz, from, to) {
      const [x0, z0] = from;
      const [x1, z1] = to;
      const dx = x1 - x0;
      const dz = z1 - z0;
      const lenSq = dx * dx + dz * dz;
      if (lenSq === 0) {
         const ox = px - x0;
         const oz = pz - z0;
         return ox * ox + oz * oz;
      }
      let t = ((px - x0) * dx + (pz - z0) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const cx = x0 + t * dx;
      const cz = z0 + t * dz;
      const ox = px - cx;
      const oz = pz - cz;
      return ox * ox + oz * oz;
   }
}


