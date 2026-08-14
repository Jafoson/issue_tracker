import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockMailConfig = mock();
mock.module("@/lib/mail/config", () => ({
  mailConfig: mockMailConfig,
  isMailConfigured: () => mockMailConfig() !== null,
}));

const mockSendMail = mock();
const mockGetTransport = mock();
mock.module("@/lib/mail/transport", () => ({
  getTransport: mockGetTransport,
}));

import { sendMail } from "@/lib/mail/send";

const MESSAGE = {
  to: "person@example.com",
  subject: "Hallo",
  html: "<p>Hallo</p>",
  text: "Hallo",
};

function reset() {
  mockMailConfig.mockReset();
  mockGetTransport.mockReset();
  mockSendMail.mockReset();
}

beforeEach(reset);

describe("sendMail()", () => {
  it("verschickt nichts, wenn kein SMTP konfiguriert ist", async () => {
    mockMailConfig.mockReturnValue(null);
    mockGetTransport.mockReturnValue(null);

    await sendMail(MESSAGE);

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("übergibt Absender und Nachricht an den Transport", async () => {
    mockMailConfig.mockReturnValue({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      from: "Issue Tracker <no-reply@smtp.example.com>",
    });
    mockGetTransport.mockReturnValue({ sendMail: mockSendMail });
    mockSendMail.mockResolvedValue(undefined);

    await sendMail(MESSAGE);

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "Issue Tracker <no-reply@smtp.example.com>",
      to: MESSAGE.to,
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      text: MESSAGE.text,
    });
  });

  it("schluckt einen Versandfehler, statt ihn weiterzureichen", async () => {
    mockMailConfig.mockReturnValue({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      from: "Issue Tracker <no-reply@smtp.example.com>",
    });
    mockGetTransport.mockReturnValue({ sendMail: mockSendMail });
    mockSendMail.mockRejectedValue(new Error("connection refused"));

    await expect(sendMail(MESSAGE)).resolves.toBeUndefined();
  });
});
