import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import HostingListPage from "@/app/[locale]/services/hosting/page";
import HostingDetailPage from "@/app/[locale]/services/hosting/[id]/page";
import { useHostingService } from "@/hooks/use-hosting";

jest.mock("@/hooks/use-hosting");
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({ get: jest.fn(() => null) })),
  useParams: jest.fn(() => ({ id: "31" })),
}));

const mockUseHosting = useHostingService as jest.Mock;

const baseHook = {
  services: [],
  overview: null,
  files: [],
  cwd: ".",
  logs: "",
  backups: [],
  loading: false,
  error: "",
  overviewLoading: false,
  overviewError: "",
  busy: null,
  loadServices: jest.fn(),
  loadOverview: jest.fn(),
  loadFiles: jest.fn(),
  loadLogs: jest.fn(),
  loadBackups: jest.fn(),
  restart: jest.fn(),
  saveFile: jest.fn(),
  createBackup: jest.fn(),
};

describe("HostingListPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("shows error with retry instead of infinite skeleton", async () => {
    const loadServices = jest.fn();
    mockUseHosting.mockReturnValue({
      ...baseHook,
      loading: false,
      error: "HTTP 500",
      loadServices,
    });
    render(<HostingListPage />);
    expect(await screen.findByText("loadError")).toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(loadServices).toHaveBeenCalled();
  });
});

describe("HostingDetailPage", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => cleanup());

  it("shows error state (not spinner) when overview fails", async () => {
    mockUseHosting.mockReturnValue({
      ...baseHook,
      overviewLoading: false,
      overviewError: "HTTP 500",
      overview: null,
    });
    render(<HostingDetailPage />);
    expect(await screen.findByText("loadError")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows not-found when service does not belong to customer", async () => {
    mockUseHosting.mockReturnValue({
      ...baseHook,
      overviewLoading: false,
      overviewError: "not-found",
      overview: null,
    });
    render(<HostingDetailPage />);
    expect(await screen.findByText("notFound")).toBeInTheDocument();
  });
});
