"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";

const CHECKLIST_FIELDS = [
  { key: "currentChallenges", label: "Principais desafios hoje", placeholder: "O que mais trava o crescimento?", rows: 3 },
  { key: "targetAudience", label: "Público-alvo", placeholder: "Quem você quer atingir?", rows: 2 },
  { key: "businessGoals", label: "Objetivos de negócio", placeholder: "Metas para os próximos meses", rows: 2 },
  { key: "technicalRequirements", label: "Requisitos técnicos", placeholder: "Integrações, plataformas, etc.", rows: 2 },
  { key: "budgetRange", label: "Faixa de investimento", placeholder: "Ex.: R$ 500–2.000/mês", rows: 1 },
  { key: "timeline", label: "Prazo desejado", placeholder: "Ex.: 30 dias", rows: 1 },
  { key: "teamSize", label: "Tamanho da equipe", placeholder: "Ex.: 3 pessoas", rows: 1 },
  { key: "existingTools", label: "Ferramentas atuais", placeholder: "CRM, ads, site, etc.", rows: 2 },
  { key: "successMetrics", label: "Como medir sucesso?", placeholder: "Leads, vendas, ROI...", rows: 2 },
  { key: "additionalNotes", label: "Observações", placeholder: "Algo mais que devemos saber?", rows: 3 },
] as const;

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
} & Record<(typeof CHECKLIST_FIELDS)[number]["key"], string>;

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  currentChallenges: "",
  targetAudience: "",
  businessGoals: "",
  technicalRequirements: "",
  budgetRange: "",
  timeline: "",
  teamSize: "",
  existingTools: "",
  successMetrics: "",
  additionalNotes: "",
};

export function ChecklistForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Não foi possível enviar o checklist.");
      }
      setSuccess(true);
      setForm(initialState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="bg-[#102238] py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-teal-400" />
          <h2 className="text-3xl font-bold text-white">Checklist enviado!</h2>
          <p className="mt-3 text-white/60">Nossa equipe vai analisar e retornar em breve.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#102238] py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <ClipboardList className="mx-auto mb-4 h-12 w-12 text-teal-400" />
          <h1 className="text-3xl font-bold text-white md:text-4xl">Checklist estratégico</h1>
          <p className="mt-3 text-white/55">
            Preencha para recebermos um diagnóstico personalizado do seu negócio.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <input required placeholder="Seu nome *" value={form.name} onChange={(e) => update("name", e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none" />
            <input required type="email" placeholder="E-mail *" value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none" />
            <input placeholder="Telefone / WhatsApp" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none" />
            <input placeholder="Empresa" value={form.company} onChange={(e) => update("company", e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none" />
          </div>

          {CHECKLIST_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-2 block text-sm font-medium text-white/80">{field.label}</label>
              <textarea
                rows={field.rows}
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none resize-y"
              />
            </div>
          ))}

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-7 py-3 text-sm font-semibold text-white disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Enviando..." : "Enviar checklist"}
          </button>
        </form>
      </div>
    </section>
  );
}
