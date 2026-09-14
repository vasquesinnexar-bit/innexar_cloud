'use client';

import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertBannerProps {
  variant?: 'error' | 'success' | 'info';
  message: string;
  onDismiss?: () => void;
}

const VARIANTS = {
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
};

export function AlertBanner({ variant = 'error', message, onDismiss }: AlertBannerProps) {
  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`flex items-center gap-3 p-4 border rounded-xl ${VARIANTS[variant]}`}
      role="alert"
    >
      <Icon className="w-5 h-5 shrink-0" />
      <p className="flex-1 text-sm">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-white/10"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
