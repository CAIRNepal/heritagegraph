"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Text } from "@react-three/drei";
import * as THREE from "three";

// Beautiful, larger cultural heritage icon with stunning visual effects
function HeritageIcon({
  position,
  color,
  size,
  label,
  onNodeClick,
  isHighlighted,
  index,
  iconType,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  onNodeClick: () => void;
  isHighlighted: boolean;
  index: number;
  iconType: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (groupRef.current) {
      // Very subtle, elegant floating animation
      const time = state.clock.elapsedTime + index * 0.4;
      groupRef.current.position.y = position[1] + Math.sin(time * 0.2) * 0.15;
      groupRef.current.rotation.y += 0.001;
      groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.02;
    }
  });

  // Generate beautiful, larger heritage icon geometries
  const iconGeometry = useMemo(() => {
    switch (iconType) {
      case "pyramid":
        return <coneGeometry args={[size, size * 3, 4]} />;
      case "temple":
        return <boxGeometry args={[size * 2.5, size * 3, size * 2.5]} />;
      case "wall":
        return <boxGeometry args={[size * 6, size * 1.5, size * 1.5]} />;
      case "dome":
        return <sphereGeometry args={[size, 24, 24]} />;
      case "tower":
        return <cylinderGeometry args={[size * 0.8, size * 0.8, size * 4]} />;
      case "arch":
        return <torusGeometry args={[size, size * 0.6, 16, 32]} />;
      case "stupa":
        return <cylinderGeometry args={[size * 1.2, size * 0.6, size * 3]} />;
      case "mountain":
        return <coneGeometry args={[size * 1.8, size * 3.5, 8]} />;
      case "palace":
        return <boxGeometry args={[size * 3, size * 2, size * 3]} />;
      case "fortress":
        return <boxGeometry args={[size * 2.5, size * 2.5, size * 2.5]} />;
      case "pagoda":
        // Realistic Asian pagoda with multiple tiers and traditional design
        return (
          <group>
            {/* Pagoda tiers */}
            {[0, 1, 2, 3, 4].map((tier, index) => (
              <mesh key={index} position={[0, size * (0.3 + tier * 0.4), 0]}>
                <boxGeometry
                  args={[
                    size * (2.8 - tier * 0.2),
                    size * 0.3,
                    size * (2.8 - tier * 0.2),
                  ]}
                />
                <meshStandardMaterial color={color} />
              </mesh>
            ))}
            {/* Pagoda roof */}
            <mesh position={[0, size * 2.3, 0]}>
              <coneGeometry args={[size * 0.4, size * 1, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {/* Pagoda finial */}
            <mesh position={[0, size * 3.1, 0]}>
              <cylinderGeometry args={[size * 0.1, size * 0.1, size * 0.6]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
      default:
        return <octahedronGeometry args={[size]} />;
    }
  }, [iconType, size]);

  return (
    <group ref={groupRef} position={position}>
      {/* Main cultural icon shape with beautiful materials */}
      <mesh
        onClick={onNodeClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {iconGeometry}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHighlighted ? 0.7 : 0.25}
          transparent
          opacity={hovered ? 0.95 : 0.9}
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>

      {/* Beautiful glow effect for highlighted nodes */}
      {isHighlighted && (
        <>
          <mesh position={[0, 0, 0.1]}>
            <sphereGeometry args={[size * 3, 24, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.2]}>
            <sphereGeometry args={[size * 4.5, 24, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.2} />
          </mesh>
        </>
      )}

      {/* Beautiful label */}
      <Html position={[0, size + 1.5, 0]} center>
        <div className="text-white text-sm font-bold bg-black/90 px-4 py-2 rounded-full whitespace-nowrap backdrop-blur-xl border border-white/40 shadow-2xl">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Cleaner, focused connections
function FocusedConnections({
  nodes,
}: {
  nodes: Array<{
    position: [number, number, number];
    id: number;
    color: string;
  }>;
}) {
  const connections = useMemo(() => {
    const conns: Array<{
      start: [number, number, number];
      end: [number, number, number];
      color: string;
      opacity: number;
    }> = [];

    nodes.forEach((node, i) => {
      // Create focused connections - connect to fewer, more meaningful nearby nodes
      const nearbyNodes = nodes
        .map((other, j) => ({
          node: other,
          distance: Math.sqrt(
            Math.pow(node.position[0] - other.position[0], 2) +
              Math.pow(node.position[1] - other.position[1], 2) +
              Math.pow(node.position[2] - other.position[2], 2),
          ),
          index: j,
        }))
        .filter((n) => n.index !== i)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4); // Connect to only 4 nearby nodes for cleaner look

      nearbyNodes.forEach((nearby) => {
        if (Math.random() > 0.3) {
          // 70% connection rate for cleaner network
          // Create beautiful cultural-themed connection colors
          const colors = [
            "#FFD700",
            "#FF6B6B",
            "#4ECDC4",
            "#45B7D1",
            "#96CEB4",
            "#FFEAA7",
            "#DDA0DD",
            "#98D8C8",
            "#F7DC6F",
            "#BB8FCE",
            "#85C1E9",
            "#F8C471",
            "#A9CCE3",
            "#F1948A",
            "#82E0AA",
          ];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];

          conns.push({
            start: node.position,
            end: nearby.node.position,
            color: randomColor,
            opacity: 0.6 + Math.random() * 0.3,
          });
        }
      });
    });

    return conns;
  }, [nodes]);

  return (
    <>
      {connections.map((conn, index) => (
        <Connection
          key={index}
          start={conn.start}
          end={conn.end}
          color={conn.color}
          opacity={conn.opacity}
          index={index}
        />
      ))}
    </>
  );
}

// Individual connection line
function Connection({
  start,
  end,
  color,
  opacity,
  index,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  opacity: number;
  index: number;
}) {
  const lineRef = useRef<THREE.Line>(null);

  useFrame((state) => {
    if (lineRef.current) {
      const material = lineRef.current.material as THREE.LineBasicMaterial;
      const time = state.clock.elapsedTime + index * 0.5;
      material.opacity = opacity + Math.sin(time * 0.3) * 0.1;
    }
  });

  const points = useMemo(() => {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(...start),
      new THREE.Vector3(
        start[0] + (end[0] - start[0]) * 0.2,
        start[1] + 1.2,
        start[2] + (end[2] - start[2]) * 0.2,
      ),
      new THREE.Vector3(
        start[0] + (end[0] - start[0]) * 0.8,
        end[1] + 1.2,
        end[2] + (end[2] - start[2]) * 0.8,
      ),
      new THREE.Vector3(...end),
    );
    return curve.getPoints(80);
  }, [start, end]);

  return (
    <primitive
      object={
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            linewidth: 2,
          }),
        )
      }
    />
  );
}

// Main focused cultural heritage scene
function FocusedCulturalScene() {
  const { camera } = useThree();

  // Focused selection of major heritage sites with cultural colors and icon types
  const nodes = useMemo(() => {
    const heritageSites = [
      { name: "Pyramids", color: "#FFD700", size: 0.6, iconType: "pyramid" },
      { name: "Great Wall", color: "#FF6B6B", size: 0.6, iconType: "wall" },
      { name: "Parthenon", color: "#4ECDC4", size: 0.55, iconType: "temple" },
      { name: "Colosseum", color: "#45B7D1", size: 0.55, iconType: "arch" },
      { name: "Taj Mahal", color: "#96CEB4", size: 0.6, iconType: "dome" },
      {
        name: "Machu Picchu",
        color: "#FFEAA7",
        size: 0.55,
        iconType: "pyramid",
      },
      { name: "Petra", color: "#DDA0DD", size: 0.5, iconType: "temple" },
      { name: "Angkor Wat", color: "#98D8C8", size: 0.6, iconType: "temple" },
      { name: "Alhambra", color: "#F7DC6F", size: 0.55, iconType: "palace" },
      { name: "Notre Dame", color: "#BB8FCE", size: 0.55, iconType: "tower" },
      { name: "Persepolis", color: "#85C1E9", size: 0.5, iconType: "palace" },
      {
        name: "Teotihuacan",
        color: "#F8C471",
        size: 0.55,
        iconType: "pyramid",
      },
      { name: "Stonehenge", color: "#A9CCE3", size: 0.5, iconType: "tower" },
      { name: "Easter Island", color: "#F1948A", size: 0.5, iconType: "tower" },
      { name: "Borobudur", color: "#82E0AA", size: 0.55, iconType: "temple" },
      { name: "Hagia Sophia", color: "#F9E79F", size: 0.55, iconType: "dome" },
      {
        name: "Forbidden City",
        color: "#D7BDE2",
        size: 0.6,
        iconType: "palace",
      },
      { name: "Versailles", color: "#AED6F1", size: 0.55, iconType: "palace" },
      { name: "Acropolis", color: "#FAD7A0", size: 0.5, iconType: "temple" },
      {
        name: "Chichen Itza",
        color: "#F39C12",
        size: 0.55,
        iconType: "pyramid",
      },
      { name: "Mohenjo-daro", color: "#E67E22", size: 0.5, iconType: "temple" },
      { name: "Babylon", color: "#E74C3C", size: 0.5, iconType: "fortress" },
      { name: "Nineveh", color: "#C0392B", size: 0.5, iconType: "fortress" },
      { name: "Ur", color: "#8E44AD", size: 0.5, iconType: "temple" },
      { name: "Susa", color: "#9B59B6", size: 0.5, iconType: "palace" },
      { name: "Ecbatana", color: "#3498DB", size: 0.5, iconType: "palace" },
      { name: "Pasargadae", color: "#2980B9", size: 0.5, iconType: "palace" },
      { name: "Bactra", color: "#1ABC9C", size: 0.5, iconType: "temple" },
      { name: "Samarkand", color: "#16A085", size: 0.5, iconType: "temple" },
      { name: "Bukhara", color: "#27AE60", size: 0.5, iconType: "temple" },
      { name: "Merv", color: "#2ECC71", size: 0.5, iconType: "temple" },
      { name: "Nisa", color: "#F1C40F", size: 0.5, iconType: "fortress" },
      { name: "Gonur", color: "#F39C12", size: 0.5, iconType: "temple" },
      { name: "Margiana", color: "#E67E22", size: 0.5, iconType: "temple" },
      { name: "Balkh", color: "#D35400", size: 0.5, iconType: "temple" },
      { name: "Taxila", color: "#E74C3C", size: 0.5, iconType: "temple" },
      { name: "Pataliputra", color: "#C0392B", size: 0.5, iconType: "palace" },
      { name: "Ujjain", color: "#8E44AD", size: 0.5, iconType: "temple" },
      { name: "Varanasi", color: "#9B59B6", size: 0.5, iconType: "temple" },
      { name: "Ayodhya", color: "#3498DB", size: 0.5, iconType: "temple" },
      { name: "Mathura", color: "#2980B9", size: 0.5, iconType: "temple" },
      { name: "Kanchipuram", color: "#1ABC9C", size: 0.5, iconType: "temple" },
      { name: "Madurai", color: "#16A085", size: 0.5, iconType: "temple" },
      { name: "Hampi", color: "#27AE60", size: 0.5, iconType: "temple" },
      { name: "Vijayanagara", color: "#2ECC71", size: 0.5, iconType: "palace" },
      { name: "Mysore", color: "#F1C40F", size: 0.5, iconType: "palace" },
      { name: "Calcutta", color: "#F39C12", size: 0.5, iconType: "temple" },
      { name: "Delhi", color: "#E67E22", size: 0.5, iconType: "fortress" },
      { name: "Agra", color: "#D35400", size: 0.5, iconType: "palace" },
      {
        name: "Fatehpur Sikri",
        color: "#E74C3C",
        size: 0.5,
        iconType: "palace",
      },
      { name: "Lahore", color: "#C0392B", size: 0.5, iconType: "fortress" },
    ];

    return heritageSites.map((site, index) => ({
      ...site,
      position: [
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 45,
      ] as [number, number, number],
      id: index,
    }));
  }, []);

  // Gentle automatic camera movement
  useFrame(() => {
    if (camera) {
      const time = Date.now() * 0.0001;
      const radius = 25;
      const height = 10;

      camera.position.x = Math.cos(time) * radius;
      camera.position.z = Math.sin(time) * radius;
      camera.position.y = height + Math.sin(time * 2) * 3;
      camera.lookAt(new THREE.Vector3(0, 0, 0));
    }
  });

  return (
    <>
      {/* Beautiful lighting for cultural depth */}
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[15, 15, 8]}
        intensity={0.5}
        color="#4A90E2"
      />
      <pointLight position={[-15, -15, -8]} intensity={0.4} color="#FF6B6B" />
      <pointLight position={[15, -15, 8]} intensity={0.4} color="#4ECDC4" />
      <pointLight position={[0, 20, 0]} intensity={0.3} color="#F7DC6F" />

      {/* Cultural heritage nodes with beautiful, larger icons */}
      {nodes.map((node, index) => (
        <HeritageIcon
          key={node.id}
          position={node.position}
          color={node.color}
          size={node.size}
          label={node.name}
          onNodeClick={() => {}} // No interaction
          isHighlighted={false} // No highlighting
          index={index}
          iconType={node.iconType}
        />
      ))}

      {/* Focused cultural connections */}
      <FocusedConnections nodes={nodes} />
    </>
  );
}

// Main component
export default function ThreeCanvas() {
  return (
    <div className="w-full h-full absolute inset-0 z-0 three-canvas">
      <Canvas
        camera={{ position: [0, 10, 25], fov: 55 }}
        style={{
          background:
            "linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a0a1a", 1);
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
      >
        <FocusedCulturalScene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableRotate={false}
          autoRotate={true}
          autoRotateSpeed={0.5}
          dampingFactor={0.1}
          enableDamping={true}
          rotateSpeed={0.4}
          zoomSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
