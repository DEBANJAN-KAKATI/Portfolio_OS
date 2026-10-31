/**
 * Built-in sample shown until real models are added to content/media.json:
 * a small low-poly desk setup made from primitives (no downloads).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';

/** Monitor wallpaper drawn on a canvas (drei <Text> would fetch a font from a CDN). */
function useScreenTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 290;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 512, 290);
    grad.addColorStop(0, '#0f2a5c');
    grad.addColorStop(1, '#1a56c4');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 290);
    g.fillStyle = '#ffffff';
    g.font = 'bold 110px Segoe UI, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DK', 256, 145);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
}

export default function PlaceholderModel({ wireframe }) {
  const logo = useRef(null);
  const screen = useScreenTexture();
  useFrame((_, dt) => {
    if (logo.current) logo.current.rotation.y += dt * 0.8;
  });
  const mat = (color, extra = {}) => <meshStandardMaterial color={color} wireframe={wireframe} roughness={0.55} {...extra} />;

  return (
    <group position={[0, -0.6, 0]}>
      {/* desk */}
      <RoundedBox args={[3.2, 0.12, 1.6]} radius={0.04} position={[0, 0.75, 0]} castShadow receiveShadow>
        {mat('#8b5e3c')}
      </RoundedBox>
      {[[-1.45, -0.7], [1.45, -0.7], [-1.45, 0.7], [1.45, 0.7]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.37, z]} castShadow>
          <boxGeometry args={[0.08, 0.75, 0.08]} />
          {mat('#3d2a1c')}
        </mesh>
      ))}
      {/* monitor */}
      <group position={[0, 1.38, -0.45]}>
        <RoundedBox args={[1.6, 0.95, 0.06]} radius={0.03} castShadow>
          {mat('#1d1d1f')}
        </RoundedBox>
        <mesh position={[0, 0, 0.032]}>
          <planeGeometry args={[1.5, 0.85]} />
          <meshStandardMaterial map={wireframe ? null : screen} emissiveMap={wireframe ? null : screen} color="#ffffff" emissive="#ffffff" emissiveIntensity={0.55} wireframe={wireframe} />
        </mesh>
        <mesh position={[0, -0.6, 0.02]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 12]} />
          {mat('#2a2a2e')}
        </mesh>
        <mesh position={[0, -0.76, 0.08]}>
          <boxGeometry args={[0.5, 0.03, 0.3]} />
          {mat('#2a2a2e')}
        </mesh>
      </group>
      {/* keyboard */}
      <RoundedBox args={[1.1, 0.04, 0.36]} radius={0.015} position={[0, 0.83, 0.3]} castShadow>
        {mat('#e8e8ec')}
      </RoundedBox>
      {/* mug */}
      <group position={[1.05, 0.95, 0.25]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.11, 0.1, 0.24, 24]} />
          {mat('#ff6b4a')}
        </mesh>
        <mesh position={[0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.06, 0.018, 8, 16]} />
          {mat('#ff6b4a')}
        </mesh>
      </group>
      {/* plant */}
      <group position={[-1.15, 0.81, -0.35]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.1, 0.24, 16]} />
          {mat('#d9d4c7')}
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <icosahedronGeometry args={[0.24, 0]} />
          {mat('#3fa34d', { flatShading: true })}
        </mesh>
      </group>
      {/* floating logo */}
      <mesh ref={logo} position={[0, 2.35, -0.45]} castShadow>
        <torusKnotGeometry args={[0.18, 0.06, 96, 12]} />
        <meshStandardMaterial color="#4cc2ff" metalness={0.6} roughness={0.2} wireframe={wireframe} />
      </mesh>
    </group>
  );
}
