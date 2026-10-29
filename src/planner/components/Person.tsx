import { useFrame } from '@react-three/fiber'
import {usePersonControls} from '../hooks/usePersonControls.ts'
import { useSphere } from '@react-three/cannon'
import { Vector3 } from 'three'

const SPEED = 5

export function Person(){
    const { forward, backward, left, right, jump } = usePersonControls()

    const [mesh, api] = useSphere(() => ({
        mass: 10,
        position: [0, 1, 0],
        type: 'Dynamic',
    }))


useFrame(() => {
    let frontVector = new Vector3(0,0,0);
    let sideVector = new Vector3(0,0,0);
    let direction = new Vector3(0,0,0);

    frontVector.set(0, 0, Number(forward) - Number(backward))
    sideVector.set(Number(right) - Number(left), 0, 0)
    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(SPEED)

    api.velocity.set(direction.x, 0, direction.z)
})

return (
    <mesh ref={mesh}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="orange" />
    </mesh>
)

}