'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { IconSparkles, IconBrandGithub } from '@tabler/icons-react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const fadeInUp = { hidden: { opacity: 0, y: 60 }, show: { opacity: 1, y: 0, transition: { duration: 0.8 } } };
const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.3 } } };
const scaleIn = { hidden: { scale: 0.8, opacity: 0 }, show: { scale: 1, opacity: 1, transition: { duration: 0.6 } } };
const glassCard = 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg';

const teamMembers = [
  { name: 'Dr. Tek Raj Chhetri', role: 'Project Lead | Researcher in AI and Digital Heritage', image: '/cair-logo/tekraj.jpeg' },
  { name: 'Dr. Semih Yumusak', role: 'Advisor | Semantic Web and Knowledge Graph Expert', image: '/team/semih.jpg' },
  { name: 'Nabin Oli', role: 'Machine Learning Researcher | Data & Graph Modeling', image: '/cair-logo/nabin.jpeg' },
  { name: 'Niraj Karki', role: 'Software Engineer | Backend & Infrastructure', image: '/cair-logo/niraj.jpeg' },
];

export default function OurTeam() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── Hero Header ── */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-8 md:p-10`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-500 opacity-95 rounded-2xl" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl animate-pulse" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-3 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-sm font-medium text-white mx-auto">
            <IconSparkles className="w-4 h-4" /> Our Team
          </div>
          <h1 className="text-3xl md:text-4xl font-black leading-tight text-white">
            The Minds Behind{' '}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">HeritageGraph</span>
          </h1>
          <p className="text-blue-100 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            A multidisciplinary team working at the intersection of artificial intelligence,
            cultural heritage, and digital knowledge systems.
          </p>
        </motion.div>
      </motion.div>

      {/* ── Team Grid ── */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}>
        <motion.h2 variants={fadeInUp} className="text-2xl font-bold mb-6 text-blue-900 dark:text-blue-100">
          Meet the{' '}
          <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">Team</span>
        </motion.h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {teamMembers.map((member) => (
            <motion.div key={member.name} variants={scaleIn} className="group relative">
              <div className={`relative p-6 ${glassCard} hover:bg-white dark:hover:bg-gray-900 transition-all duration-500 transform hover:scale-[1.02] overflow-hidden hover:shadow-xl`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl" />
                <div className="flex gap-4 items-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 rounded-full blur-sm opacity-50" />
                    <Image src={member.image} alt={member.name} width={72} height={72}
                      className="relative rounded-full object-cover border-2 border-white dark:border-gray-600 shadow-lg" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                      {member.name}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{member.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Action Links ── */}
      <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeInUp} className="flex gap-4 flex-col sm:flex-row">
        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white rounded-full font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 gap-2" asChild>
          <a href="https://github.com/CAIRNepal/heritagegraph" target="_blank" rel="noopener noreferrer">
            <IconBrandGithub className="w-5 h-5" /> View GitHub
          </a>
        </Button>
        <Button variant="outline" size="lg" className="border-blue-300 dark:border-gray-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-full font-semibold transition-all duration-300 gap-2" asChild>
          <a href="https://www.cair-nepal.org/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" /> Read Docs
          </a>
        </Button>
      </motion.div>
    </div>
  );
}
