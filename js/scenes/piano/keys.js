export const createKey = (model, options = {}) => {
   const position = options.position || [0, 0, 0];
   const width = options.width === undefined ? 0.16 : options.width;
   const depth = options.depth === undefined ? 0.5 : options.depth;
   const baseHeight = options.baseHeight === undefined ? 0.02 : options.baseHeight;
   const travel = options.travel === undefined ? 0.012 : options.travel;
   const pressThreshold = options.pressThreshold === undefined ? 0.03 : options.pressThreshold;
   const baseColor = options.baseColor || [0.15, 0.15, 0.15];
   const topColor = options.topColor || [0.95, 0.95, 0.95];
   const labelText = options.labelText || null;
   const labelColor = options.labelColor || [0.1, 0.1, 0.1];
   const labelScale = options.labelScale === undefined ? 1 : options.labelScale;
   const labelOffset = options.labelOffset || [0, 0.018, -0.18];

   const root = model.add().move(position[0], position[1], position[2]);
   const base = root.add('square');
   const top = root.add('square');
   const label = labelText ? root.add(clay.text(labelText, true)) : null;

   const key = {
      node: root,
      base,
      top,
      isPressed: false,
      signal: false,
      onPress: options.onPress || null,
      onRelease: options.onRelease || null,
      update: (inputEvents, hands = ['left', 'right']) => {
         key.signal = false;

         let isPressing = false;
         for (let i = 0; i < hands.length; i++) {
            const hand = hands[i];
            const pos = inputEvents.pos(hand);
            if (!pos || pos.length < 3) continue;
            const dx = pos[0] - position[0];
            const dz = pos[2] - position[2];
            if (Math.abs(dx) <= width / 2 && Math.abs(dz) <= depth / 2) {
               const topY = position[1] + baseHeight;
               if (pos[1] <= topY + pressThreshold &&
                   pos[1] >= topY - travel - pressThreshold) {
                  isPressing = true;
                  break;
               }
            }
         }

         if (isPressing && !key.isPressed) {
            key.signal = true;
            if (key.onPress) key.onPress();
         }
         if (!isPressing && key.isPressed) {
            if (key.onRelease) key.onRelease();
         }
         key.isPressed = isPressing;

         const pressAmount = key.isPressed ? travel : 0;

         base.identity()
             .move(0, 0, 0)
             .turnX(-Math.PI / 2)
             .scale(width, depth, 1)
             .color(baseColor[0], baseColor[1], baseColor[2]);

         top.identity()
            .move(0, baseHeight - pressAmount, 0.0005)
            .turnX(-Math.PI / 2)
            .scale(width * 0.96, depth * 0.96, 1)
            .color(topColor[0], topColor[1], topColor[2]);

         if (label) {
            label.identity()
                 .move(labelOffset[0], baseHeight + labelOffset[1], labelOffset[2])
                 .turnX(-Math.PI / 2)
                 .scale(labelScale)
                 .color(labelColor[0], labelColor[1], labelColor[2]);
         }
      }
   };

   return key;
};

