"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Globe, Mountain } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [searchSuggestions] = useState([
    "Ancient Egypt Pyramids",
    "Medieval Angkor Wat",
    "Classical Greek Parthenon",
    "Silk Road trade routes",
    "Buddhist temples Asia",
    "Islamic architecture",
    "Indigenous knowledge",
    "Cultural festivals",
    "Traditional crafts",
    "Heritage sites UNESCO",
    "Ancient civilizations",
    "Medieval castles",
    "Classical Roman ruins",
    "Traditional music",
    "Cultural textiles",
    "Sacred sites",
    "Archaeological discoveries",
    "Cultural preservation",
    "Traditional medicine",
    "Ancient wisdom",
  ]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Main Search Input */}
      <motion.div
        animate={{
          scale: isFocused ? 1.02 : 1,
          boxShadow: isFocused
            ? "0 0 40px rgba(14, 165, 233, 0.4)"
            : "0 0 20px rgba(14, 165, 233, 0.2)",
        }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder || "Search cultural heritage..."}
            className="w-full px-6 py-4 pl-16 pr-20 text-lg bg-white/20 backdrop-blur-md border-2 border-white/40 rounded-full text-white placeholder-white/70 focus:outline-none focus:border-white/60 transition-all duration-300"
          />

          {/* Search Icon */}
          <div className="absolute left-5 top-1/2 transform -translate-y-1/2">
            <Search className="w-6 h-6 text-white/80" />
          </div>

          {/* Search Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-heritage-500 to-heritage-600 text-white font-semibold rounded-full hover:from-heritage-600 hover:to-heritage-700 transition-all duration-300"
          >
            Search
          </motion.button>
        </div>
      </motion.div>

      {/* Floating Icons */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            y: [0, -10, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-8 -left-4 text-heritage-300"
        >
          <Sparkles className="w-5 h-5" />
        </motion.div>

        <motion.div
          animate={{
            y: [0, -8, 0],
            rotate: [0, -3, 0],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute -top-6 -right-6 text-temple-300"
        >
          <Globe className="w-4 h-4" />
        </motion.div>

        <motion.div
          animate={{
            y: [0, -12, 0],
            rotate: [0, 4, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute -bottom-8 left-8 text-mountain-300"
        >
          <Mountain className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Search Suggestions */}
      {isFocused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="absolute top-full left-0 right-0 mt-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 z-20"
        >
          <div className="text-white/80 text-sm mb-3 font-medium">
            Popular heritage searches:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {searchSuggestions.map((suggestion, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{
                  scale: 1.02,
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                }}
                onClick={() => onChange(suggestion)}
                className="text-left px-3 py-2 rounded-lg text-white/70 hover:text-white transition-all duration-200 text-sm"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="text-center mt-4 text-white/60 text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <div className="w-2 h-2 bg-heritage-400 rounded-full animate-pulse"></div>
          Connecting wisdom • Linking stories • Illuminating heritage…
        </span>
      </motion.div>
    </div>
  );
}
