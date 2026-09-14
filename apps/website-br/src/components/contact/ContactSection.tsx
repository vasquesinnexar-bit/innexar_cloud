"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";

const whatsappUrl = `https://wa.me/${SITE_CONFIG.whatsapp}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre os serviços da Innexar.")}`;

const channels = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "(13) 99182-1557",
    href: whatsappUrl,
  },
  {
    icon: Mail,
    label: "E-mail",
    value: "comercial@innexar.com.br",
    href: "mailto:comercial@innexar.com.br",
  },
  {
    icon: Phone,
    label: "Telefone",
    value: "(13) 99182-1557",
    href: "tel:+5513991821557",
  },
  {
    icon: MapPin,
    label: "Endereço",
    value: "Praia Grande, São Paulo — Brasil",
    href: null,
  },
];

export function ContactSection() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const referrerSource = searchParams.get("source");

  const leadSource = useMemo(() => {
    if (referrerSource === "checklist") return "website_checklist";
    if (referrerSource === "planos") return "website_planos";
    if (pathname === "/") return "website_home_contact";
    return "website_contact";
  }, [referrerSource, pathname]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/contact/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          source: leadSource,
          extra_data: {
            page: pathname,
            referrer_source: referrerSource ?? undefined,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Não foi possível enviar sua mensagem.");
      }

      setSuccess("Mensagem enviada com sucesso. Nossa equipe vai responder em breve.");
      setFormData({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar formulário.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="bg-[#102238] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Canais de contato</h2>
          <p className="mx-auto max-w-2xl text-white/50">
            Escolha a forma mais conveniente para falar com nossa equipe.
          </p>
        </motion.div>

        <div className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <h3 className="mb-1 text-xl font-bold text-white">Envie uma mensagem</h3>
          <p className="mb-6 text-sm text-white/55">Retorno em ate 24 horas uteis.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                required
                placeholder="Seu nome"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
              />
              <input
                type="email"
                required
                placeholder="Seu e-mail"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
              />
            </div>

            <input
              type="tel"
              placeholder="Telefone / WhatsApp (opcional)"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
            />

            <textarea
              rows={5}
              required
              placeholder="Conte brevemente o que você precisa"
              value={formData.message}
              onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/40 focus:border-teal-500 focus:outline-none"
            />

            {error && <p className="text-sm text-red-300">{error}</p>}
            {success && <p className="text-sm text-teal-300">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,201,177,0.35)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Enviando..." : "Enviar mensagem"}
            </button>
          </form>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {channels.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <c.icon className="mb-3 h-10 w-10 text-teal-400" />
              <p className="mb-1 text-sm text-white/50">{c.label}</p>
              {c.href ? (
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="text-lg font-semibold text-white hover:text-teal-400 transition-colors"
                >
                  {c.value}
                </a>
              ) : (
                <p className="text-lg font-semibold text-white">{c.value}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
