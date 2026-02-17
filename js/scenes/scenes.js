import * as global from "../global.js";
import { Gltf2Node } from "../render/nodes/gltf2.js";

export default () => {
   global.scene().addNode(new Gltf2Node({
      url: ""
   })).name = "backGround";

   return {
      enableSceneReloading: true,
      scenes: [ 

         { name: "lightCyclePvP"       , path: "./lightcycleGrid/lightCyclePvP.js"       , public: true },
      ]
   };
}

