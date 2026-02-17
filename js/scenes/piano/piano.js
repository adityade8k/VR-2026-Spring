import { createKey } from "./keys.js";

export const init = async model => {
   const Tone = window.Tone;
   let toneReady = false;
   let synth = Tone ? new Tone.Synth().toDestination() : null;

   const ensureTone = async () => {
      if (!Tone || toneReady) return;
      await Tone.start();
      toneReady = true;
   };

   const keys = [];
   const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
   const keyCount = notes.length;
   const keySpacing = 0.37;
   const startX = -((keyCount - 1) * keySpacing) / 2;
   const y = 1.05;
   const z = -0.6;

   for (let i = 0; i < keyCount; i++) {
      const x = startX + i * keySpacing;
      const key = createKey(model, {
         position: [x, y, z],
         width: 0.155,
         depth: 0.5,
         labelText: notes[i],
         labelScale: 5,
         labelOffset: [-0.05, 0.03, 0.18],
         onPress: async () => {
            if (!Tone || !synth) return;
            await ensureTone();
            synth.triggerAttackRelease(notes[i], '8n');
         }
      });
      keys.push(key);
   }

   model.animate(() => {
      for (let i = 0; i < keys.length; i++) {
         keys[i].update(inputEvents);
      }
   });
};

