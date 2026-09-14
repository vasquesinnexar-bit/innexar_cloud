"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

function FaqAccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-semibold text-theme-primary">{item.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-theme-secondary transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-theme-secondary whitespace-pre-line leading-relaxed">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function PortalFaqPage() {
  const t = useTranslations("faqPage");

  const categories = [
    "gettingStarted",
    "dashboard",
    "briefing",
    "projects",
    "billing",
    "support",
    "account",
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-theme-primary mb-2">{t("title")}</h1>
        <p className="text-theme-secondary">{t("subtitle")}</p>
      </div>

      {categories.map((category, index) => {
        const items = t.raw(`sections.${category}.items`) as Array<{ id: string; question: string; answer: string }>;
        return (
          <motion.section
            key={category}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold text-theme-primary">{t(`sections.${category}.title`)}</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <FaqAccordionItem key={`${category}-${item.id}`} item={item} />
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
