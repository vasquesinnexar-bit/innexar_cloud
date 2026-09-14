"use client";

import { Building2, Palette, PenLine } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

const STEP_ICONS = [Building2, Palette, PenLine] as const;

type SiteBriefingProgressBarProps = {
  totalSteps: number;
  currentStep: number;
  setCurrentStep: (n: number) => void;
  stepLabels: string[];
};

export function SiteBriefingProgressBar({
  totalSteps,
  currentStep,
  setCurrentStep,
  stepLabels,
}: SiteBriefingProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const StepIcon = STEP_ICONS[i];
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <div key={i} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => {
                if (i < currentStep) setCurrentStep(i);
              }}
              disabled={i > currentStep}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full
                ${isActive ? "bg-[var(--step-active-bg)] border border-[var(--step-active-border)] text-[var(--step-active-text)]" : ""}
                ${isCompleted ? "bg-[var(--step-done-bg)] border border-[var(--step-done-border)] text-[var(--step-done-text)] cursor-pointer hover:opacity-80" : ""}
                ${!isActive && !isCompleted ? "bg-[var(--card-bg)] border border-[var(--border)] text-theme-muted" : ""}
              `}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
                  ${isActive ? "bg-cyan-500 text-white" : ""}
                  ${isCompleted ? "bg-green-500 text-white" : ""}
                  ${!isActive && !isCompleted ? "bg-[var(--border)] text-theme-muted" : ""}
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </div>
              <span className="hidden sm:block truncate">{stepLabels[i]}</span>
            </button>
            {i < totalSteps - 1 && (
              <div
                className={`w-4 h-0.5 shrink-0 ${i < currentStep ? "bg-green-400" : "bg-[var(--border)]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
