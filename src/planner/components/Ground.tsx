export function Ground(props:any) {
  return (
    <mesh ref={props.ref} position={props.position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
}