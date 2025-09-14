"use client";

import { motion } from "framer-motion";

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-heritage-900 via-heritage-800 to-mountain-900 overflow-hidden">
      {/* Cultural Heritage Timeline Network */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Timeline Axis */}
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-heritage-300 via-heritage-500 to-heritage-700"
        />

        {/* Timeline Periods */}
        {[
          {
            period: "Ancient",
            y: "15%",
            color: "from-temple-400 to-temple-600",
          },
          {
            period: "Classical",
            y: "35%",
            color: "from-heritage-400 to-heritage-600",
          },
          {
            period: "Medieval",
            y: "55%",
            color: "from-mountain-400 to-mountain-600",
          },
          {
            period: "Modern",
            y: "75%",
            color: "from-heritage-300 to-heritage-500",
          },
        ].map((era, index) => (
          <motion.div
            key={era.period}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: index * 0.5 }}
            className={`absolute left-1/2 transform -translate-x-1/2 w-32 h-8 bg-gradient-to-r ${era.color} rounded-full flex items-center justify-center text-white text-xs font-semibold`}
            style={{ top: era.y }}
          >
            {era.period}
          </motion.div>
        ))}

        {/* Cultural Events Nodes - Reduced count for cleaner look */}
        {[
          // Ancient Period
          {
            x: "25%",
            y: "12%",
            event: "Pyramids",
            region: "Egypt",
            icon: "🏛️",
          },
          {
            x: "75%",
            y: "18%",
            event: "Great Wall",
            region: "China",
            icon: "🏯",
          },
          {
            x: "40%",
            y: "25%",
            event: "Parthenon",
            region: "Greece",
            icon: "🏛️",
          },
          {
            x: "60%",
            y: "22%",
            event: "Colosseum",
            region: "Rome",
            icon: "🏟️",
          },

          // Classical Period
          {
            x: "20%",
            y: "32%",
            event: "Silk Road",
            region: "Asia",
            icon: "🛤️",
          },
          {
            x: "80%",
            y: "38%",
            event: "Teotihuacan",
            region: "Mesoamerica",
            icon: "🗿",
          },
          {
            x: "50%",
            y: "42%",
            event: "Persepolis",
            region: "Persia",
            icon: "🏰",
          },

          // Medieval Period
          {
            x: "30%",
            y: "52%",
            event: "Alhambra",
            region: "Spain",
            icon: "🕌",
          },
          {
            x: "70%",
            y: "58%",
            event: "Angkor Wat",
            region: "Cambodia",
            icon: "🕍",
          },
          {
            x: "50%",
            y: "62%",
            event: "Notre Dame",
            region: "France",
            icon: "⛪",
          },
          {
            x: "60%",
            y: "68%",
            event: "Taj Mahal",
            region: "India",
            icon: "🕌",
          },

          // Modern Period
          {
            x: "35%",
            y: "72%",
            event: "Machu Picchu",
            region: "Peru",
            icon: "🏔️",
          },
          { x: "65%", y: "78%", event: "Petra", region: "Jordan", icon: "🏛️" },
        ].map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
            className="absolute"
            style={{ left: event.x, top: event.y }}
          >
            {/* Event Node */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 3, 0],
              }}
              transition={{ duration: 4, repeat: Infinity, delay: index * 0.3 }}
              className="relative"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-heritage-400 to-heritage-600 rounded-full flex items-center justify-center text-2xl shadow-lg border-2 border-white/30">
                {event.icon}
              </div>

              {/* Event Label */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                <div className="text-white text-xs font-semibold bg-black/50 px-2 py-1 rounded whitespace-nowrap">
                  {event.event}
                </div>
                <div className="text-heritage-200 text-xs bg-black/30 px-2 py-1 rounded mt-1 whitespace-nowrap">
                  {event.region}
                </div>
              </div>

              {/* Connection Line to Timeline */}
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.2,
                }}
                className="absolute top-1/2 left-1/2 w-px h-16 bg-gradient-to-b from-heritage-400 to-transparent transform -translate-x-1/2"
                style={{
                  transformOrigin: "top",
                  transform: `translateX(-50%) rotate(${(Math.atan2(parseInt(event.y) - 50, parseInt(event.x) - 50) * 180) / Math.PI}deg)`,
                }}
              />
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Floating Temples and Cultural Structures - Reduced for cleaner look */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large Temple Right - Angkor Wat Style */}
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 bottom-40"
        >
          <div className="relative">
            {/* Temple Base */}
            <div className="w-32 h-40 bg-gradient-to-b from-temple-600 to-temple-800 rounded-t-lg"></div>
            {/* Temple Roofs - Angkor Style */}
            <div className="absolute -top-4 left-2 w-28 h-8 bg-gradient-to-b from-temple-500 to-temple-600 rounded-t-lg"></div>
            <div className="absolute -top-8 left-4 w-24 h-6 bg-gradient-to-b from-temple-400 to-temple-500 rounded-t-lg"></div>
            <div className="absolute -top-12 left-6 w-20 h-4 bg-gradient-to-b from-temple-300 to-temple-400 rounded-t-lg"></div>
            {/* Temple Spire */}
            <div className="absolute -top-16 left-9 w-6 h-8 bg-gradient-to-b from-temple-200 to-temple-300 rounded-t-lg"></div>
          </div>
        </motion.div>

        {/* Medium Temple Left - Greek Parthenon Style */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-32 bottom-32"
        >
          <div className="relative">
            <div className="w-24 h-32 bg-gradient-to-b from-heritage-600 to-heritage-800 rounded-t-lg"></div>
            {/* Greek Columns */}
            <div className="absolute -top-3 left-2 w-20 h-6 bg-gradient-to-b from-heritage-500 to-heritage-600 rounded-t-lg"></div>
            <div className="absolute -top-6 left-4 w-16 h-4 bg-gradient-to-b from-heritage-400 to-heritage-500 rounded-t-lg"></div>
            <div className="absolute -top-9 left-6 w-12 h-3 bg-gradient-to-b from-heritage-300 to-heritage-400 rounded-t-lg"></div>
            {/* Triangular Pediment */}
            <div className="absolute -top-12 left-3 w-18 h-6 bg-gradient-to-b from-heritage-300 to-heritage-400 transform rotate-45"></div>
          </div>
        </motion.div>

        {/* Stupa - Buddhist Style */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-40 bottom-60"
        >
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-b from-white to-gray-200 rounded-full"></div>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-8 bg-gradient-to-b from-heritage-300 to-heritage-400 rounded-t-lg"></div>
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-2 h-4 bg-gradient-to-b from-heritage-200 to-heritage-300 rounded-t-lg"></div>
            {/* Prayer Flags */}
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-gradient-to-r from-temple-300 via-heritage-300 to-mountain-300 rounded"></div>
          </div>
        </motion.div>
      </div>

      {/* Cultural Patterns and Symbols - Reduced for cleaner look */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Mandala Pattern */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-24 h-24 opacity-5"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <circle
              cx="50"
              cy="50"
              r="25"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <circle
              cx="50"
              cy="50"
              r="15"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="50"
              y1="5"
              x2="50"
              y2="95"
              stroke="white"
              strokeWidth="1"
            />
            <line
              x1="5"
              y1="50"
              x2="95"
              y2="50"
              stroke="white"
              strokeWidth="1"
            />
          </svg>
        </motion.div>

        {/* Islamic Geometric Pattern */}
        <motion.div
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/3 right-1/4 w-20 h-20 opacity-5"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon
              points="50,10 61,35 88,35 68,55 79,80 50,65 21,80 32,55 12,35 39,35"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </svg>
        </motion.div>
      </div>

      {/* Floating People Silhouettes - Reduced count */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 0],
              x: [0, Math.sin(i) * 8, 0],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.8,
            }}
            className="absolute bottom-20"
            style={{ left: `${25 + i * 20}%` }}
          >
            <div className="w-3 h-8 bg-white/20 rounded-full"></div>
            <div className="w-4 h-2 bg-white/20 rounded-full mt-1"></div>
          </motion.div>
        ))}
      </div>

      {/* Animated Clouds - Reduced count */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ x: [1200, -200] }}
            transition={{
              duration: 25 + i * 5,
              repeat: Infinity,
              ease: "linear",
              delay: i * 3,
            }}
            className="absolute top-20"
            style={{ top: `${15 + i * 20}%` }}
          >
            <div className="w-24 h-12 bg-white/8 rounded-full blur-sm"></div>
          </motion.div>
        ))}
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-heritage-900/80 via-transparent to-transparent"></div>
    </div>
  );
}
