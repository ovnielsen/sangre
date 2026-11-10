import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { Vector2, Color, type Mesh, type PlaneGeometry, type ShaderMaterial } from "three";

import vertexShader from "./shaders/vertexShader.glsl";
import fragmentShader from "./shaders/fragmentShader.glsl";

const Gradient = () => {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  const updateMousePosition = useCallback((e: MouseEvent) => {
    mousePosition.current = { x: e.pageX, y: e.pageY };
  }, []);

  const uniforms = useMemo(
    () => ({
      u_time: {
        value: 0.0,
      },
      u_mouse: { value: new Vector2(0, 0) },
      u_bg: {
        value: new Color("#d31b0e"),
      },
      u_colorA: { value: new Color("#ff0000") },
      u_colorB: { value: new Color("#e01a1a") },
    }),
    []
  );

  useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition, false);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition, false);
    };
  }, [updateMousePosition]);

  useFrame((state) => {
    const { clock } = state;
    if (!mesh.current) return;

    mesh.current.material.uniforms.u_time.value = clock.getElapsedTime();
    mesh.current.material.uniforms.u_mouse.value.set(
      mousePosition.current.x,
      mousePosition.current.y
    );
  });

  return (
    <mesh ref={mesh} position={[0, 0, 0]} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
        wireframe={false}
      />
    </mesh>
  );
};

const ShaderBg = () => {
  return (
    <div className="bg-canvas">
      <Canvas camera={{ position: [0.0, 0.0, 1.5] }}>
        <Gradient />
      </Canvas>
    </div>
  );
};

export default ShaderBg;

