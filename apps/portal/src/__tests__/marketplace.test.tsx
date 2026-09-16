import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import Detail from "@/app/[locale]/services/catalog/[id]/page";
import MyServices from "@/app/[locale]/services/page";
import CatalogPage from "@/app/[locale]/services/catalog/page";
import { useMarketplace } from "@/hooks/use-marketplace";

jest.mock("@/hooks/use-marketplace");
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useParams: jest.fn(() => ({ id: "1" })),
}));

const mockUseMarketplace = useMarketplace as jest.Mock;

const product = {
  id: 1,
  name: "E-mail Profissional",
  description: "Contas de e-mail",
  category: "email",
  slug: "professional-email",
  fulfillment_handler: "mail",
  fulfillment_strategy: "guided",
  plans: [
    {
      id: 10,
      name: "Mensal",
      interval: "monthly",
      amount: 25,
      currency: "BRL",
      billing_type: "recurring",
      unit: "mailbox",
    },
  ],
};

function mockHook(over: Record<string, unknown> = {}) {
  mockUseMarketplace.mockReturnValue({
    loading: false,
    error: "",
    getCatalog: jest.fn(async () => [product]),
    purchase: jest.fn(async () => ({ data: null, error: null })),
    getMyServices: jest.fn(async () => []),
    getServicesOverview: jest.fn(async () => ({
      items: [],
      email_domains: [],
      hosting_services: [],
      projects: [],
    })),
    ...over,
  });
}

describe("CatalogPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("shows loading state", () => {
    mockUseMarketplace.mockReturnValue({
      loading: true,
      error: "",
      getCatalog: jest.fn(async () => null),
      purchase: jest.fn(),
      getMyServices: jest.fn(async () => []),
      getServicesOverview: jest.fn(async () => ({
        items: [],
        email_domains: [],
        hosting_services: [],
        projects: [],
      })),
    });
    render(<CatalogPage />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state", async () => {
    mockHook({ getCatalog: jest.fn(async () => []) });
    render(<CatalogPage />);
    expect(await screen.findByText("empty")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockUseMarketplace.mockReturnValue({
      loading: false,
      error: "boom",
      getCatalog: jest.fn(async () => null),
      purchase: jest.fn(),
      getMyServices: jest.fn(async () => []),
      getServicesOverview: jest.fn(async () => ({
        items: [],
        email_domains: [],
        hosting_services: [],
        projects: [],
      })),
    });
    render(<CatalogPage />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("renders product cards with price", async () => {
    mockHook();
    render(<CatalogPage />);
    expect(await screen.findByText("E-mail Profissional")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /hire/ })).toHaveAttribute("href", "./catalog/1");
  });
});

describe("ProductDetailPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("selects plan, sets quantity and confirms once on double click", async () => {
    const purchase = jest.fn(async () => ({
      data: {
        contract_id: 1,
        contract_item_id: 2,
        invoice_id: 3,
        total: 50,
        currency: "BRL",
        status: "pending",
        reused: false,
      },
      error: null,
    }));
    mockHook({ purchase });
    render(<Detail />);
    expect(
      await screen.findByText("E-mail Profissional", {}, { timeout: 5000 })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/quantity/), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "review" }));
    const confirm = await screen.findByRole("button", { name: "confirm" });
    fireEvent.click(confirm);
    // botão desabilita durante o submit: segundo clique não reenvia
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(purchase).toHaveBeenCalledTimes(1));
    expect(purchase).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 1, price_plan_id: 10, quantity: 2 })
    );
    const firstCall = purchase.mock.calls as unknown[][];
    expect(firstCall[0][0]).toHaveProperty("idempotency_key");
  });

  it("shows unavailable when product has no plans", async () => {
    mockHook({
      getCatalog: jest.fn(async () => [{ ...product, plans: [] }]),
    });
    render(<Detail />);
    expect(await screen.findByText("unavailable")).toBeInTheDocument();
  });
});

const overviewOf = (items: unknown[], hosting: unknown[] = []) => ({
  items,
  email_domains: [],
  hosting_services: hosting,
  projects: [],
});

describe("MyServicesPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("shows empty state and pending/active badges", async () => {
    mockHook({ getServicesOverview: jest.fn(async () => overviewOf([])) });
    render(<MyServices />);
    expect(await screen.findByText("noServices")).toBeInTheDocument();

    mockHook({
      getServicesOverview: jest.fn(async () =>
        overviewOf([
          {
            id: 1,
            product_name: "E-mail",
            description: null,
            quantity: 1,
            unit_amount: 25,
            source: "portal",
            invoice_id: 9,
            invoice_status: "pending",
            invoice_total: 25,
            fulfillment_status: null,
            fulfillment_step: null,
          },
          {
            id: 2,
            product_name: "Site",
            description: null,
            quantity: 1,
            unit_amount: 500,
            source: "portal",
            invoice_id: 10,
            invoice_status: "paid",
            invoice_total: 500,
            fulfillment_status: "active",
            fulfillment_step: "done",
          },
        ])
      ),
    });
    render(<MyServices />);
    expect(await screen.findByText("pendingPayment")).toBeInTheDocument();
    expect(screen.getByText("serviceActive")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "continuePayment" })).toHaveAttribute(
      "href",
      "../billing?pay=9"
    );
  });

  it("groups setup fee under one service card (not a second service)", async () => {
    mockHook({
      getServicesOverview: jest.fn(async () =>
        overviewOf([
          {
            id: 45,
            product_name: "E-mail Profissional",
            description: "E-mail Profissional mensal",
            quantity: 1,
            unit_amount: 25,
            source: "workspace",
            invoice_id: null,
            invoice_status: null,
            invoice_total: null,
            fulfillment_status: "active",
            fulfillment_step: null,
            is_setup: false,
          },
          {
            id: 44,
            product_name: "E-mail Profissional",
            description: "Setup E-mail Profissional (one_time)",
            quantity: 1,
            unit_amount: 100,
            source: "workspace",
            invoice_id: 401,
            invoice_status: "pending",
            invoice_total: 100,
            fulfillment_status: null,
            fulfillment_step: null,
            is_setup: true,
          },
        ])
      ),
    });
    render(<MyServices />);
    const titles = await screen.findAllByText("E-mail Profissional");
    expect(titles).toHaveLength(1);
    expect(screen.getByText(/setupPending/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "continuePayment" })).toHaveAttribute(
      "href",
      "../billing?pay=401"
    );
  });

  it("shows hosting card from overview and error with retry", async () => {
    mockHook({
      getServicesOverview: jest.fn(async () =>
        overviewOf(
          [],
          [
            {
              id: 31,
              primary_domain: "touficsleiman.com.br",
              status: "active",
              runtime: "online",
              project: "sitetoufic",
              environment: "production",
            },
          ]
        )
      ),
    });
    render(<MyServices />);
    expect(await screen.findByText("touficsleiman.com.br")).toBeInTheDocument();
    expect(screen.getByText("hostingTitle")).toBeInTheDocument();

    cleanup();
    const retry = jest.fn(async () => overviewOf([]));
    mockUseMarketplace.mockReturnValue({
      loading: false,
      error: "loadError",
      getCatalog: jest.fn(),
      purchase: jest.fn(),
      getMyServices: jest.fn(async () => []),
      getServicesOverview: retry,
    });
    render(<MyServices />);
    expect(await screen.findByText("loadError")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(retry).toHaveBeenCalled();
  });
});
