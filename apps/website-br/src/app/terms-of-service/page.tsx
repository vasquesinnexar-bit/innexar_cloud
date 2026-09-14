import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de uso e condições gerais dos serviços da Innexar.",
  alternates: { canonical: "/terms-of-service" },
};

export default function TermsOfServicePage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="mb-8 text-4xl font-bold text-white">Termos de Uso</h1>
      <p className="mb-6 text-white/70">
        Última atualização: 08/04/2026
      </p>

      <div className="space-y-6 text-white/80">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">1. Aceitação</h2>
          <p>
            Ao acessar e utilizar o site innexar.com.br e os serviços da Innexar, você concorda com estes termos.
            Caso não concorde, não utilize nossos serviços.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">2. Serviços</h2>
          <p>
            A Innexar oferece criação de sites, desenvolvimento de aplicativos, marketing digital e soluções com IA.
            As condições específicas de cada projeto são definidas em contrato ou proposta comercial.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">3. Propriedade Intelectual</h2>
          <p>
            O conteúdo do site (textos, imagens, layout) é de propriedade da Innexar. Em projetos contratados, a
            propriedade do site desenvolvido é transferida ao cliente após a quitação total, salvo acordo em contrário.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">4. Pagamento e Cancelamento</h2>
          <p>
            Os valores e condições de pagamento são definidos em proposta. O cancelamento de assinaturas ou serviços
            recorrentes pode ser solicitado conforme o contrato vigente.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">5. Limitação de Responsabilidade</h2>
          <p>
            A Innexar não se responsabiliza por danos indiretos ou perda de lucros decorrentes do uso dos serviços.
            Nosso compromisso é com a qualidade da entrega conforme escopo acordado.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">6. Contato</h2>
          <p>
            Dúvidas sobre estes termos: comercial@innexar.com.br | (13) 99182-1557
          </p>
        </section>
      </div>
    </article>
  );
}
