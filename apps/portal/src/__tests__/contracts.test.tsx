import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ContractsPage from "@/app/[locale]/contracts/page";
import ContractDetailPage from "@/app/[locale]/contracts/[id]/page";
import { workspaceFetch, getCustomerToken } from "@/lib/workspace-api";

jest.mock("@/lib/workspace-api", () => ({
  workspaceFetch: jest.fn(),
  getCustomerToken: jest.fn(() => "tok"),
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useParams: jest.fn(() => ({ id: "40" })),
}));

const mockFetch = workspaceFetch as jest.Mock;

const contract = {
  id: 40,
  status: "pending",
  currency: "BRL",
  billing_interval: "monthly",
  billing_day: 25,
  created_at: "2026-09-16T00:00:00Z",
  items: [
    {
      id: 44,
      product_name: "E-mail Profissional",
      plan_name: "Setup",
      description: "Setup",
      quantity: 1,
      unit_amount: 100.0,
    },
  ],
};

describe("ContractsPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("lists contracts with link to detail", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [contract] });
    render(<ContractsPage />);
    const link = await screen.findByRole("link", { name: /contract/ });
    expect(link).toHaveAttribute("href", "/en/contracts/40");
    expect(getCustomerToken).toHaveBeenCalled();
  });

  it("shows error with retry on API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<ContractsPage />);
    expect(await screen.findByText("loadError")).toBeInTheDocument();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    fireEvent.click(screen.getByText("retry"));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("ContractDetailPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("shows items with names and amounts", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => contract });
    render(<ContractDetailPage />);
    expect(await screen.findByText("E-mail Profissional")).toBeInTheDocument();
    expect(screen.getByText("Setup")).toBeInTheDocument();
  });

  it("shows not-found for other customer contract", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    render(<ContractDetailPage />);
    expect(await screen.findByText("notFound")).toBeInTheDocument();
  });
});
