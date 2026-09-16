import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OpenInvoicesModal from "@/components/dashboard/OpenInvoicesModal";

const invoices = [
  { total: 100.0, currency: "BRL", due_date: "2026-09-23", href: "/billing?pay=401" },
];

function renderModal() {
  return render(
    <OpenInvoicesModal
      locale="pt"
      invoices={invoices}
      title="openInvoicesTitle"
      subtitle="openInvoicesSub"
      payLabel="payInvoice"
      laterLabel="later"
    />
  );
}

describe("OpenInvoicesModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });
  afterEach(() => cleanup());

  it("shows open invoices with pay link once per session", () => {
    renderModal();
    expect(screen.getByText("openInvoicesTitle")).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
    const pay = screen.getByRole("link", { name: "payInvoice" });
    expect(pay).toHaveAttribute("href", "/pt/billing?pay=401");
    fireEvent.click(screen.getByText("later"));
    expect(sessionStorage.getItem("innexar-open-invoices-seen")).toBe("1");
  });

  it("does not show again after dismissal", () => {
    sessionStorage.setItem("innexar-open-invoices-seen", "1");
    renderModal();
    expect(screen.queryByText("openInvoicesTitle")).not.toBeInTheDocument();
  });

  it("renders nothing without open invoices", () => {
    render(
      <OpenInvoicesModal
        locale="pt"
        invoices={[]}
        title="openInvoicesTitle"
        subtitle="openInvoicesSub"
        payLabel="payInvoice"
        laterLabel="later"
      />
    );
    expect(screen.queryByText("openInvoicesTitle")).not.toBeInTheDocument();
  });
});
