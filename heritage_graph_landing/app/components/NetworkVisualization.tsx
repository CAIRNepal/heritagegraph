"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamic import for the 3D Canvas to avoid SSR issues
const ThreeCanvas = dynamic(() => import("./ThreeCanvas"), {
  ssr: false,
  loading: () => <LoadingBackground />,
});

// Loading Background Component
function LoadingBackground() {
  const [dots, setDots] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);

  useEffect(() => {
    // Generate random dots for the loading background
    const newDots = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setDots(newDots);
  }, []);

  return (
    <div className="hero-background-container w-full h-full absolute inset-0 z-0 network-visualization overflow-hidden">
      {/* Animated background dots */}
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute w-1 h-1 bg-white/40 rounded-full animate-pulse"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            animationDelay: `${dot.delay}s`,
            animationDuration: "4s",
          }}
        />
      ))}

      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-2xl font-semibold mb-4">
            Heritage Graph
          </div>
          <div className="text-white/80 text-lg">
            Connecting wisdom • Linking stories • Illuminating heritage…
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function NetworkVisualization() {
  return (
    <div className="hero-background-container w-full h-full absolute inset-0 z-0 network-visualization overflow-hidden">
      <ThreeCanvas />
    </div>
  );
}
