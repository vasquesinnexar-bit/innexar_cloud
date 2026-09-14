"use client";

import { useState } from "react";
import { FAQItem, SectionHeader } from "@/components/ui/ReusableCards";

const faqs = [
  {
    question: "Quanto custa um site profissional?",
    answer:
      "O preço varia conforme a complexidade do projeto. Temos opções desde sites por assinatura (a partir de R$ 299/mês) até projetos customizados. Faça uma consulta para um orçamento personalizado.",
  },
  {
    question: "Qual é o prazo de entrega?",
    answer:
      "Prazos variam de 2 semanas para páginas simples até 3-4 meses para aplicações complexas. Durante a proposta, estabelecemos um timeline claro e realista.",
  },
  {
    question: "Vocês hospedam o site?",
    answer:
      "Sim! Oferecemos hospedagem inclusa em nossos planos. Você não precisa se preocupar com infraestrutura técnica. Apenas escolha seu domínio e pronto.",
  },
  {
    question: "Posso ter suporte após o lançamento?",
    answer:
      "Sim. O suporte e a evolução após o lançamento são definidos no escopo do projeto ou em um plano de manutenção contínua.",
  },
  {
    question: "Como funciona o site por assinatura?",
    answer:
      "É simples: você paga uma mensalidade fixa e recebe um site profissional, hospedado, otimizado e com suporte incluso. Sem investimento inicial. Perfeito para pequenos negócios.",
  },
  {
    question: "Vocês fazem otimização para SEO?",
    answer:
      "Sim! Todos os sites são otimizados desde o início para aparecer melhor no Google. Oferecemos também serviços de marketing digital e estratégia de SEO avançada.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative overflow-hidden bg-[#102238] py-24 md:py-32">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 top-1/3 h-96 w-96 rounded-full bg-teal-500/[0.05] blur-[120px] orb-float" />
        <div className="absolute right-0 bottom-1/3 h-96 w-96 rounded-full bg-orange-500/[0.04] blur-[100px] orb-float orb-delay" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 md:px-10">
        <SectionHeader
          badge="Dúvidas"
          title="Perguntas"
          subtitle="As respostas para as dúvidas mais comuns. Ainda tem dúvida? Entre em contato!"
          highlight="Frequentes"
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() =>
                setOpenIndex(openIndex === index ? null : index)
              }
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
