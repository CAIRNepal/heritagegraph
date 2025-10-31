"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}

export default function FeatureCard({
  icon,
  title,
  description,
  color,
}: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{
        y: -8,
        scale: 1.02,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
      }}
      transition={{ duration: 0.3 }}
      className="group relative p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/30 hover:border-white/50 transition-all duration-300 overflow-hidden"
    >
      {/* Background Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
      />

      {/* Icon Container */}
      <motion.div
        whileHover={{ rotate: 5, scale: 1.1 }}
        transition={{ duration: 0.3 }}
        className={`relative w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:shadow-lg transition-all duration-300`}
      >
        <motion.div
         animate={{
            y: [0, -3, 0],
            rotate: [0, 2, 0],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>

        {/* Glow Effect */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${color} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300`}
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-xl font-bold text-mountain-800 mb-3 group-hover:text-mountain-900 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-mountain-600 leading-relaxed group-hover:text-mountain-700 transition-colors duration-300">
          {description}
        </p>
      </div>

      {/* Hover Border Effect */}
      <div
        className={`absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-opacity-20 transition-all duration-500`}
        style={{
          borderImage: `linear-gradient(45deg, ${color.replace("from-", "").replace("to-", "")}) 1`,
        }}
      />

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 0],
              x: [0, Math.sin(i) * 10, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 1.5,
            }}
            className={`absolute w-2 h-2 bg-gradient-to-r ${color} rounded-full`}
            style={{
              left: `${20 + i * 30}%`,
              top: `${30 + i * 20}%`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
