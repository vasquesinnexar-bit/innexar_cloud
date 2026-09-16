import { render, screen, cleanup } from "@testing-library/react";
import EmailServicePage from "@/app/[locale]/services/email/page";
import { useEmailService } from "@/hooks/use-email-service";

jest.mock("@/hooks/use-email-service");
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useParams: jest.fn(() => ({})),
}));

const mockUseEmail = useEmailService as jest.Mock;

// Payload real do cliente 893 em produção (GET /api/portal/services/email).
const overview893 = {
  domain: "touficsleiman.com.br",
  status: "active",
  entitlement: {
    contracted: 1,
    used: 1,
    available: 0,
    currency: "BRL",
    unit_price: 25.0,
    provider_fallback: "mercadopago",
  },
  mailboxes: [
    {
      id: 20,
      address: "contato@touficsleiman.com.br",
      display_name: null,
      quota: null,
      status: "active",
      created_at: "2026-09-16T14:57:24.739874Z",
      usage_used: "7.0K",
      usage_pct: "0",
      last_activity: null,
    },
  ],
};

function mockOk(over: Record<string, unknown> = {}) {
  mockUseEmail.mockReturnValue({
    overview: overview893,
    domains: [{ id: 16, domain: "touficsleiman.com.br", status: "active" }],
    loading: false,
    error: "",
    actionLoading: null,
    load: jest.fn(async () => undefined),
    createMailbox: jest.fn(),
    requestMailbox: jest.fn(),
    changePassword: jest.fn(),
    toggleDisabled: jest.fn(),
    ...over,
  });
}

describe("EmailServicePage with real 893 payload", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("renders domain, mailbox and connect guide (no blank page)", () => {
    mockOk();
    render(<EmailServicePage />);
    expect(screen.getAllByText("contato@touficsleiman.com.br").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("mail.touficsleiman.com.br").length).toBeGreaterThanOrEqual(1);
  });

  it("survives missing entitlement/mailboxes without crashing", () => {
    mockOk({ overview: { domain: "x.com.br", status: "active" } });
    const { container } = render(<EmailServicePage />);
    expect(container.textContent ?? "").not.toHaveLength(0);
  });
});
