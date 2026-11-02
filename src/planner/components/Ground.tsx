export function Ground(props: any) {
  const { pencilDraft = false, ...meshProps } = props;
  return (
    <mesh
      {...meshProps}
      ref={props.ref}
      position={props.position}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={!pencilDraft}
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="gray"
        polygonOffset
        polygonOffsetFactor={2}
        polygonOffsetUnits={2}
      />
    </mesh>
  );
}