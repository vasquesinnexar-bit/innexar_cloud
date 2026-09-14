"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";

interface StepCardProps {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export function StepCard({
  number,
  icon: Icon,
  title,
  description,
  index,
}: StepCardProps) {
  const fromLeft = index % 2 === 0;
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: fromLeft ? -50 : 50,
        y: 28,
        rotate: fromLeft ? -2.5 : 2.5,
        scale: 0.94,
        filter: "blur(8px)",
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600">
            <span className="text-lg font-bold text-white">{number}</span>
          </div>
          <div className="rounded-lg bg-teal-500/10 p-2.5">
            <Icon className="h-6 w-6 text-teal-400" />
          </div>
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/60">{description}</p>
      </div>
    </motion.div>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
  badge?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
  badge,
}: FeatureCardProps) {
  const fromLeft = index % 2 === 0;
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: fromLeft ? -60 : 60,
        y: 34,
        rotateX: 16,
        rotateY: fromLeft ? -10 : 10,
        scale: 0.92,
        filter: "blur(10px)",
      }}
      whileInView={{
        opacity: 1,
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        filter: "blur(0px)",
      }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm transition-all duration-300 hover:border-teal-500/30 hover:bg-teal-500/5"
      style={{ transformPerspective: 1200, transformStyle: "preserve-3d" }}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-teal-700/5 transition-all duration-300" />

      <div className="relative z-10">
        {badge && (
          <span className="mb-3 inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-400">
            {badge}
          </span>
        )}

        <div className="mb-4 inline-flex rounded-lg bg-teal-500/10 p-3">
          <Icon className="h-6 w-6 text-teal-400" />
        </div>

        <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/60">{description}</p>
      </div>
    </motion.div>
  );
}

interface SectionHeaderProps {
  badge: string;
  title: string;
  subtitle: string;
  highlight?: string;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  highlight,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mb-16 text-center"
    >
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/12 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[2px] text-teal-400">
        {badge}
      </span>
      <AnimatedTitle as="h2" className="mb-6 text-3xl font-black leading-tight text-white md:text-4xl lg:text-5xl">
        {title}
        {highlight && (
          <>
            {" "}
            <span className="bg-gradient-to-r from-teal-400 to-teal-200 bg-clip-text text-transparent">
              {highlight}
            </span>
          </>
        )}
      </AnimatedTitle>
      <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
        {subtitle}
      </p>
    </motion.div>
  );
}

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

export function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: FAQItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="border-b border-white/10"
    >
      <button
        onClick={onToggle}
        className="group flex w-full items-center justify-between py-6 text-left transition-colors hover:text-teal-400"
      >
        <span className="text-base font-semibold text-white md:text-lg">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="ml-4 flex-shrink-0"
        >
          <svg
            className="h-5 w-5 text-teal-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.div>
      </button>

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{
          opacity: isOpen ? 1 : 0,
          height: isOpen ? "auto" : 0,
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <p className="pb-6 text-sm leading-relaxed text-white/60 md:text-base">
          {answer}
        </p>
      </motion.div>
    </motion.div>
  );
}
