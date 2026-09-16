import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EmailConnectGuide from "@/components/email/EmailConnectGuide";

describe("EmailConnectGuide", () => {
  afterEach(() => cleanup());

  it("shows IMAP/SMTP hosts, ports, example username and webmail link", () => {
    render(
      <EmailConnectGuide
        domain="touficsleiman.com.br"
        exampleAddress="contato@touficsleiman.com.br"
        webmailUrl="https://webmail.innexar.com.br"
      />
    );
    expect(screen.getAllByText("mail.touficsleiman.com.br").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("993")).toBeInTheDocument();
    expect(screen.getByText("587")).toBeInTheDocument();
    expect(screen.getByText("contato@touficsleiman.com.br")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openWebmailBtn" })).toHaveAttribute(
      "href",
      "https://webmail.innexar.com.br"
    );
  });

  it("copies value on click without crashing", async () => {
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <EmailConnectGuide
        domain="touficsleiman.com.br"
        exampleAddress={null}
        webmailUrl="https://webmail.innexar.com.br"
      />
    );
    fireEvent.click(screen.getAllByText("mail.touficsleiman.com.br")[0]);
    expect(writeText).toHaveBeenCalledWith("mail.touficsleiman.com.br");
  });
});
