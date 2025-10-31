'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
// import { useRouter } from 'next/navigation';
// import {
//   ClerkProvider,
//   SignInButton,
//   SignUpButton,
//   SignedIn,
//   SignedOut,
//   useAuth,
// } from '@clerk/nextjs';

import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
// import { NavigationMenu, NavigationMenuItem } from '@/components/ui/navigation-menu';
import {
  Menu,
  Star,
  Globe,
  BookOpen,
  Building,
  Scroll,
  Users,
  Github,
  Mail,
  ExternalLink,
  LucideIcon,
  Link,
} from 'lucide-react';

// Animation Variants
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  show: { scale: 1, opacity: 1, transition: { duration: 0.6 } },
};

// Floating Particles Component
const FloatingParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array(20)
      .fill(0)
      .map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-blue-400/20 rounded-full"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.5, 0.2],
            transition: {
              duration: Math.random() * 5 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: 'linear',
            },
          }}
        />
      ))}
  </div>
);

// Gradient Orbs Component
const GradientOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-blue-300/20 to-blue-500/20 rounded-full blur-3xl animate-pulse" />
    <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-r from-sky-300/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse delay-1000" />
    <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-gradient-to-r from-blue-200/20 to-sky-400/20 rounded-full blur-3xl animate-pulse delay-2000" />
  </div>
);

interface PreservationItem {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: string;
}

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [0.95, 1]);
  const heroY = useTransform(scrollYProgress, [0, 0.5], [0, -100]);
  // const { isSignedIn } = useAuth(); // client-side auth check
  // const router = useRouter();

  // useEffect(() => {
  //   if (!isSignedIn) router.push('/sign-in'); // redirect client-side if not signed in
  // }, [isSignedIn, router]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const preservationItems: PreservationItem[] = [
    {
      icon: Building,
      title: 'Ancient Temples',
      description:
        'Sacred architecture spanning centuries of Nepali craftsmanship and spiritual heritage.',
      gradient: 'from-blue-400 to-sky-500',
    },
    {
      icon: Scroll,
      title: 'Sacred Manuscripts',
      description:
        'Rare texts and documents preserving ancient knowledge and cultural wisdom.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Globe,
      title: 'Living Traditions',
      description:
        'Festivals, rituals, and cultural practices that continue to thrive today.',
      gradient: 'from-sky-400 to-blue-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 text-blue-900 font-sans scroll-smooth overflow-x-hidden">
      <GradientOrbs />
      <FloatingParticles />

      {/* Header */}
      <motion.header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-white/80 backdrop-blur-xl border-b border-blue-200' : 'bg-transparent'}`}
        style={{ opacity: headerOpacity }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg flex items-center justify-center">
              <Link href="/">
                <BookOpen className="w-4 h-4 text-white" />
              </Link>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              <Link href="/">HeritageGraph</Link>
            </h1>
          </motion.div>

          <nav className="hidden md:flex items-center gap-8">
            {['Explore', 'Dashboard', 'About', 'Contact'].map((item) => {
              const href =
                item === 'Dashboard' ? '/dashboard' : `#${item.toLowerCase()}`;
              return (
                <a
                  key={item}
                  href={href}
                  className="text-blue-800 hover:text-blue-600 transition-all duration-300"
                >
                  {item}
                </a>
              );
            })}
            {/* <SignedOut>
                <SignInButton />
                <SignUpButton />
              </SignedOut> */}
          </nav>

          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="bg-white/90 backdrop-blur-xl border-blue-200 text-blue-900"
              >
                <nav className="mt-8 flex flex-col gap-6">
                  {['Explore', 'Dashboard', 'About', 'Contact'].map((item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase()}`}
                      className="text-lg text-blue-800 hover:text-blue-600"
                    >
                      {item}
                    </a>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <motion.section
          style={{ y: heroY }}
          className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center"
        >
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="max-w-4xl mx-auto space-y-8"
          >
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-full text-sm text-blue-700">
                <Star className="w-4 h-4 text-blue-500" />
                Preserving Cultural Heritage Through AI
              </div>

              <h1 className="text-4xl md:text-6xl font-black leading-tight">
                <span className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
                  Preserving Our Shared Cultural Heritage
                </span>
                <br />
                {/* Subtitle */}
                <p className="mt-2 text-base md:text-lg font-medium text-slate-800">
                  Understanding Identity, Safeguarding the Future
                </p>
              </h1>
            </motion.div>

            <motion.p
              variants={fadeInUp}
              className="text-base md:text-lg text-blue-700 max-w-2xl mx-auto leading-relaxed"
            >
              Explore the history, art, and traditions that shape our shared identity —
              digitally preserved through
              <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text font-semibold">
                {' '}
                Knowledge Graphs
              </span>
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                Start Exploring
              </Button>
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100/50 px-8 py-3 rounded-full text-lg font-semibold transition-all duration-300"
              >
                Learn More
              </Button>
            </motion.div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <motion.div
              className="w-6 h-10 border-2 border-blue-300 rounded-full flex justify-center"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-1 h-3 bg-blue-400 rounded-full mt-2" />
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Explore Section */}
        <section id="explore" className="relative py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={staggerContainer}
              className="text-center mb-16"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-4xl md:text-5xl font-bold mb-6 text-blue-900"
              >
                What We{' '}
                <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
                  Preserve
                </span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-xl text-blue-700 max-w-3xl mx-auto"
              >
                From centuries-old temples to rare manuscripts, we document and digitize
                Nepal&apos;s diverse cultural assets using cutting-edge knowledge graph
                technology.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-8"
            >
              {preservationItems.map((item) => (
                <motion.div
                  key={item.title}
                  variants={scaleIn}
                  className="group relative"
                >
                  <div className="relative p-8 bg-white/80 backdrop-blur-sm border border-blue-200 rounded-2xl hover:bg-white transition-all duration-500 transform hover:scale-[1.02] overflow-hidden shadow-lg hover:shadow-xl">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                    />
                    <div
                      className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${item.gradient} mb-6 shadow-lg`}
                    >
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-blue-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-sky-500 group-hover:bg-clip-text transition-all duration-300">
                      {item.title}
                    </h3>
                    <p className="text-blue-700 leading-relaxed">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* About Section */}
        <section
          id="about"
          className="relative py-24 px-6 bg-gradient-to-br from-blue-100 to-sky-100"
        >
          <div className="relative max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={staggerContainer}
              className="text-center space-y-8"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-4xl md:text-5xl font-bold text-blue-900"
              >
                How You Can{' '}
                <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
                  Contribute
                </span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-xl text-blue-800 max-w-4xl mx-auto leading-relaxed"
              >
                Whether you&apos;re a researcher, student, or local expert, your insights are
                valuable in helping us build a richer and more reliable cultural
                knowledge graph. We actively welcome interdisciplinary research on — or
                built upon — the HeritageGraph platform.
              </motion.p>
              <motion.p variants={fadeInUp} className="text-lg text-blue-700">
                If you&apos;re interested in collaborating, feel free to reach out to
                CAIR-Nepal.
              </motion.p>
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8"
              >
                <Button className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg">
                  <Github className="w-5 h-5 mr-2" />
                  View on GitHub
                </Button>
                <Button
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100/50 px-8 py-3 rounded-full font-semibold transition-all duration-300"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Contact Us
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Team Section */}
        <section className="relative py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-8"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl font-bold text-blue-800"
              >
                An initiative by
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-xl text-blue-700">
                A collective of technologists, historians, and cultural workers.
              </motion.p>
              <motion.div variants={scaleIn} className="inline-block">
                <div className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-sky-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
                  <div className="relative bg-white/80 backdrop-blur-sm border border-blue-200 rounded-2xl p-8 hover:bg-white transition-all duration-500 shadow-lg">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-sky-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                      <Users className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-blue-900 mb-2">CAIR-Nepal</h3>
                    <p className="text-blue-700 mb-4">
                      Center for Artificial Intelligence Research
                    </p>
                    <a
                      href="https://www.cair-nepal.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center text-blue-600 hover:text-blue-500 hover:bg-blue-100/50 px-4 py-2 rounded-md transition-all duration-300"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit Website
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          id="contact"
          className="relative py-24 px-6 bg-gradient-to-br from-blue-100 to-sky-100"
        >
          <div className="relative max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="space-y-8"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-4xl md:text-5xl font-bold text-blue-900"
              >
                Join Our{' '}
                <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
                  Mission
                </span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-xl text-blue-800 max-w-2xl mx-auto"
              >
                Help us safeguard Nepal&apos;s intangible and tangible heritage — digitally,
                collaboratively.
              </motion.p>
              <motion.div variants={fadeInUp}>
                <Button className="bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white px-12 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl">
                  Get Involved
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="relative py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl md:text-4xl font-bold text-center mb-12 text-blue-900"
              >
                Frequently Asked{' '}
                <span className="text-transparent bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text">
                  Questions
                </span>
              </motion.h2>
              <motion.div variants={fadeInUp}>
                <Accordion type="single" collapsible className="space-y-4">
                  {[
                    {
                      value: 'ontology',
                      question: 'Which ontology does HeritageGraph use?',
                      answer:
                        'HeritageGraph is based on CIDOC-CRM, an ISO standard ontology widely used in the cultural heritage domain.',
                    },
                    {
                      value: 'digital-preservation',
                      question:
                        'How does this help preserve cultural heritage, which is a physical task?',
                      answer:
                        'While preserving cultural heritage physically also remains crucial, documenting and sharing heritage digitally is also becoming increasingly important. Digital preservation ensures that information about cultural practices, artifacts, and traditions can be accessed, searched, and interacted with online, extending their reach and longevity.',
                    },
                    {
                      value: 'contribution',
                      question: 'Can I contribute to HeritageGraph?',
                      answer:
                        'Yes, the project is open-source and available on GitHub. Contributions from the community are welcome.',
                    },
                    {
                      value: 'research-idea',
                      question:
                        "I have a research idea, but I'm not from an AI background. Can I still contribute?",
                      answer:
                        "Absolutely. HeritageGraph encourages interdisciplinary collaboration. Feel free to reach out to CAIR-Nepal — we'd be happy to explore how we can work together.",
                    },
                    {
                      value: 'funding',
                      question: 'Is this project funded by any organization?',
                      answer: 'Not at the moment :-)',
                    },
                    {
                      value: 'funding',
                      question: 'What license does HeritageGraph has?',
                      answer:
                        'The license for HeritageGraph has not yet been finalized, but we intend to choose one that balances community benefits with the future interests of CAIR.',
                    },
                  ].map((item) => (
                    <AccordionItem
                      key={item.value}
                      value={item.value}
                      className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-lg px-6 hover:bg-white transition-all duration-300 shadow-sm"
                    >
                      <AccordionTrigger className="text-blue-900 hover:text-blue-600 transition-colors duration-300 text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-blue-700 leading-relaxed">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-blue-200 bg-white/80 backdrop-blur-sm">
        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-sky-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-blue-900">HeritageGraph</span>
            </div>
            <p className="text-blue-700 text-center">
              © {new Date().getFullYear()} HeritageGraph. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-blue-700 hover:text-blue-600 hover:bg-blue-100/50"
              >
                <Github className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-blue-700 hover:text-blue-600 hover:bg-blue-100/50"
              >
                <Mail className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-blue-700 hover:text-blue-600 hover:bg-blue-100/50"
              >
                <ExternalLink className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
