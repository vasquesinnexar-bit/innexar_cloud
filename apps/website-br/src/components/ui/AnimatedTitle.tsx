"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type TitleTag = "h1" | "h2" | "h3";

interface AnimatedTitleProps {
  as?: TitleTag;
  className?: string;
  children: ReactNode;
}

const titleMotion = {
  initial: { opacity: 0, y: 26, filter: "blur(8px)", scale: 0.98 },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 },
  transition: { duration: 0.8 },
  viewport: { once: true, margin: "-80px" as const },
};

export function AnimatedTitle({ as = "h2", className, children }: AnimatedTitleProps) {
  if (as === "h1") {
    return (
      <motion.h1
        initial={titleMotion.initial}
        whileInView={titleMotion.whileInView}
        transition={titleMotion.transition}
        viewport={titleMotion.viewport}
        className={cn("relative title-fx", className)}
      >
        {children}
      </motion.h1>
    );
  }

  if (as === "h3") {
    return (
      <motion.h3
        initial={titleMotion.initial}
        whileInView={titleMotion.whileInView}
        transition={titleMotion.transition}
        viewport={titleMotion.viewport}
        className={cn("relative title-fx", className)}
      >
        {children}
      </motion.h3>
    );
  }

  return (
    <motion.h2
      initial={titleMotion.initial}
      whileInView={titleMotion.whileInView}
      transition={titleMotion.transition}
      viewport={titleMotion.viewport}
      className={cn("relative title-fx", className)}
    >
      {children}
    </motion.h2>
  );
}
