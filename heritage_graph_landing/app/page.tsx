"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Globe,
  Network,
  Mountain,
  Building2,
  Users,
  BookOpen,
  Sparkles,
} from "lucide-react";
import HeroBackground from "./components/HeroBackground";
import SearchBar from "./components/SearchBar";
import FeatureCard from "./components/FeatureCard";
import NetworkVisualization from "./components/NetworkVisualization";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  const features = [
    {
      icon: <Network className="w-8 h-8" />,
      title: "Knowledge Networks",
      description:
        "Explore interconnected cultural knowledge through advanced graph databases",
      color: "from-heritage-500 to-heritage-600",
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Cultural Heritage",
      description:
        "Discover ancient traditions, architecture, and stories from around the world",
      color: "from-temple-500 to-temple-600",
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Global Connections",
      description:
        "See how cultures influence and connect across continents and time",
      color: "from-mountain-500 to-mountain-600",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Community Wisdom",
      description: "Learn from indigenous knowledge and community traditions",
      color: "from-heritage-400 to-heritage-500",
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Digital Preservation",
      description: "Safeguard cultural knowledge for future generations",
      color: "from-temple-400 to-temple-500",
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "AI-Powered Insights",
      description: "Discover hidden connections and patterns in cultural data",
      color: "from-mountain-400 to-mountain-500",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section - Dark with 3D Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
        {/* 3D Background Animation - Only in Hero */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <div className="w-full h-full">
            <NetworkVisualization />
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 text-shadow-lg">
              <span className="heritage-gradient bg-clip-text text-transparent">
                Heritage Graph
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto text-shadow">
              Where ancient wisdom meets modern knowledge networks. Explore the
              interconnected tapestry of cultural heritage through intelligent
              data visualization.
            </p>
          </motion.div>

          {/* Search Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-12"
          >
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search cultural heritage, traditions, or knowledge..."
            />
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <button className="px-8 py-4 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white font-semibold hover:bg-white/30 transition-all duration-300 hover:scale-105">
              Explore Knowledge Graph
            </button>
            <button className="px-8 py-4 heritage-gradient rounded-full text-white font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105">
              Start Your Journey
            </button>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white/70 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-mountain-800 mb-6">
              Discover the Power of
              <span className="heritage-gradient bg-clip-text text-transparent">
                {" "}
                Connected Knowledge
              </span>
            </h2>
            <p className="text-xl text-mountain-600 max-w-3xl mx-auto">
              Our platform transforms how we understand and preserve cultural
              heritage through intelligent knowledge graphs and advanced data
              visualization.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <FeatureCard {...feature} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-heritage-600 to-heritage-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            {[
              { number: "10K+", label: "Cultural Artifacts" },
              { number: "500+", label: "Indigenous Communities" },
              { number: "50+", label: "Countries Represented" },
              { number: "1M+", label: "Knowledge Connections" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-white"
              >
                <div className="text-4xl md:text-5xl font-bold mb-2">
                  {stat.number}
                </div>
                <div className="text-heritage-100">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-6 bg-gradient-to-br from-mountain-100 to-heritage-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-mountain-800 mb-6">
              Ready to Explore Your Cultural Heritage?
            </h2>
            <p className="text-xl text-mountain-600 mb-8">
              Join thousands of researchers, historians, and cultural
              enthusiasts in discovering the hidden connections that shape our
              world.
            </p>
            <button className="px-10 py-5 heritage-gradient rounded-full text-white font-semibold text-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Get Started Today
            </button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
