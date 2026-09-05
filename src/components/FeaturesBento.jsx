import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  LayoutGrid, 
  TrendingUp, 
  Atom, 
  FlaskConical, 
  Dna 
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 35, scale: 0.95 },
  visible: (custom = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: custom * 0.12,
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1], // slick cubic-bezier
    },
  }),
};

export default function FeaturesBento() {
  return (
    <section style={{ position: 'relative', width: '100%', padding: '112px 20px', backgroundColor: '#070b14', color: 'white', overflow: 'hidden', minHeight: '100vh', boxSizing: 'border-box' }}>
      {/* Background Subtle Radial Glow */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '700px', height: '700px', backgroundColor: 'rgba(37, 99, 235, 0.1)', filter: 'blur(150px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1152px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        
        {/* Section Heading */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          style={{ textAlign: 'center', maxWidth: '672px', margin: '0 auto 64px auto' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '9999px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)', color: '#60a5fa', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: '#60a5fa' }} />
            Simulation Platform
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, margin: '0 0 16px 0' }}>
            From Static PDFs to <br />
            <span style={{ color: 'transparent', backgroundImage: 'linear-gradient(to right, #60a5fa, #a5b4fc, #22d3ee)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
              Live Mock Exams.
            </span>
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: 1.625 }}>
            Upload your coaching modules from any institute. Our core engine instantly parses questions, diagrams, and options into a strict NTA-style CBT environment.
          </p>
        </motion.div>

        {/* Bento Middle Cluster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'stretch', marginBottom: '32px' }}>
          
          {/* Left Column (Cards 1 & 2) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', justifyContent: 'space-between' }}>
            <motion.div
              custom={1}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 }, borderColor: 'rgba(59, 130, 246, 0.4)' }}
              style={{ padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(12, 20, 39, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', flex: 1, cursor: 'default' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', marginBottom: '16px' }}>
                <FileText style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: '0 0 8px 0' }}>Instant PDF Parsing</h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.625, margin: 0 }}>
                Upload any institute's PDF. Our engine extracts clean MCQs, complex math equations, and diagrams seamlessly.
              </p>
            </motion.div>

            <motion.div
              custom={2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 }, borderColor: 'rgba(16, 185, 129, 0.4)' }}
              style={{ padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(12, 20, 39, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', flex: 1, cursor: 'default' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '16px' }}>
                <CheckCircle2 style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: '0 0 8px 0' }}>NTA Scoring Engine</h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.625, margin: 0 }}>
                Strict +4 / -1 negative marking simulation to build real exam temperament and penalty awareness.
              </p>
            </motion.div>
          </div>

          {/* Center Column: 3D Floating Timer Card */}
          <motion.div
            custom={3}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            style={{ padding: '32px', borderRadius: '24px', backgroundImage: 'linear-gradient(to bottom, #101b38, #0a1020)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxShadow: '0 0 50px rgba(37, 99, 235, 0.18)', position: 'relative', overflow: 'hidden' }}
          >
            {/* Ambient Pulse Ring behind Clock */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(59, 130, 246, 0.05)', filter: 'blur(40px)', borderRadius: '50%' }} />
            
            {/* Floating Clock Container */}
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
              style={{ width: '176px', height: '176px', borderRadius: '50%', border: '2px dashed rgba(96, 165, 250, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '24px', backdropFilter: 'blur(12px)' }}
            >
              <div style={{ width: '144px', height: '144px', borderRadius: '50%', backgroundColor: 'rgba(23, 37, 84, 0.4)', border: '1px solid rgba(96, 165, 250, 0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)', position: 'relative' }}>
                <Clock style={{ width: '36px', height: '36px', color: '#60a5fa', marginBottom: '4px' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, letterSpacing: '0.05em', color: 'white' }}>03:00:00</span>
                <span style={{ fontSize: '10px', color: 'rgba(147, 197, 253, 0.8)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>NTA Standard</span>
              </div>
            </motion.div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'white', position: 'relative', zIndex: 10, margin: '0 0 8px 0' }}>Pressure Simulation</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.625, maxWidth: '320px', position: 'relative', zIndex: 10, margin: 0 }}>
              Master time management with exact NEET test duration tracking and realistic CBT UI.
            </p>
          </motion.div>

          {/* Right Column (Cards 3 & 4) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', justifyContent: 'space-between' }}>
            <motion.div
              custom={2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 }, borderColor: 'rgba(6, 182, 212, 0.4)' }}
              style={{ padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(12, 20, 39, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', flex: 1, cursor: 'default' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', marginBottom: '16px' }}>
                <LayoutGrid style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: '0 0 8px 0' }}>Live Question Palette</h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.625, margin: 0 }}>
                Track your flow with standard NTA status indicators: Answered, Marked for Review, and Unvisited.
              </p>
            </motion.div>

            <motion.div
              custom={3}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2 }, borderColor: 'rgba(168, 85, 247, 0.4)' }}
              style={{ padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(12, 20, 39, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(24px)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', flex: 1, cursor: 'default' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c084fc', marginBottom: '16px' }}>
                <TrendingUp style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: '0 0 8px 0' }}>Deep Analytics</h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.625, margin: 0 }}>
                Post-test chapter-wise breakdown, accuracy tracking, and personalized rank booster insights.
              </p>
            </motion.div>
          </div>

        </div>

        {/* Bottom Dedicated Subject Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', paddingTop: '16px' }}>
          {[
            {
              title: "Physics",
              sub: "Mechanics & Thermodynamics",
              icon: Atom,
              colorObj: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
              delay: 4,
            },
            {
              title: "Chemistry",
              sub: "Organic & Physical Chemistry",
              icon: FlaskConical,
              colorObj: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
              delay: 5,
            },
            {
              title: "Biology",
              sub: "Botany & Human Physiology",
              icon: Dna,
              colorObj: { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.2)', text: '#f472b6' },
              delay: 6,
            }
          ].map((subj, idx) => {
            const Icon = subj.icon;
            return (
              <motion.div
                key={idx}
                custom={subj.delay * 0.8}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 }, borderColor: 'rgba(255, 255, 255, 0.2)' }}
                style={{ padding: '20px', borderRadius: '16px', backgroundColor: 'rgba(12, 20, 39, 0.6)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', cursor: 'default' }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: subj.colorObj.bg, border: `1px solid ${subj.colorObj.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: subj.colorObj.text, flexShrink: 0 }}>
                  <Icon style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 700, fontSize: '16px', color: '#e5e7eb', margin: '0 0 2px 0' }}>{subj.title}</h4>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{subj.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
