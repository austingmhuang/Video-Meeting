import React, { useState, useEffect } from "react";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { VRM, VRMUtils, VRMSchema } from "@pixiv/three-vrm";

export default function Avatar(props) {
  const [scene, setScene] = useState(null);
  const gltf = useLoader(GLTFLoader, props.url);

  useEffect(() => {
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    VRM.from(gltf).then((vrm) => {
      setScene(vrm.scene);
      // 初期描画で背中が映ってしまうので向きを変えてあげる
      const boneNode = vrm.humanoid?.getBoneNode(
        VRMSchema.HumanoidBoneName.Hips
      );
      boneNode.rotateY(Math.PI);
    });
  }, [gltf, setScene]);

  if (scene === null) {
    return null;
  }

  return <primitive object={scene} dispose={null} />;
}
