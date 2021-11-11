import React from "react";
import { Canvas } from "@react-three/fiber";
import styled from "styled-components";
import Controls from "./Three/Controls";
import Model from "./Three/Model";

export default function Three({ url }) {
  return (
    <Container>
      <Canvas>
        <ambientLight intensity={0.3}/>
        <directionalLight intensity={0.1} position={[0, 0, 0]} />
        <Controls />
        <Model url={url} />
        <gridHelper /> {/* わかりやすいようにGridPanelを表示 */}
      </Canvas>
    </Container>
  );
}

const Container = styled.div`
  width: 100vw;
  height: 100vh;
`;
