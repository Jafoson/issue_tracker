import { describe, expect, it } from "bun:test";
import { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
import {
  escapeHtml,
  formatDateDe,
  humanizeKey,
} from "@/lib/mail/templates/html";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
import { notificationEmail } from "@/lib/mail/templates/notification";
import { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
import { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
import { welcomeEmail } from "@/lib/mail/templates/welcome";

describe("escapeHtml()", () => {
  it("escaped die fünf HTML-Sonderzeichen", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });
});

describe("humanizeKey()", () => {
  it("macht aus einem Statuskey einen lesbaren Text", () => {
    expect(humanizeKey("in_progress")).toBe("In progress");
    expect(humanizeKey("todo")).toBe("Todo");
  });
});

describe("formatDateDe()", () => {
  it("formatiert fest auf Deutsch, unabhängig vom Server-Locale", () => {
    expect(formatDateDe(new Date("2026-08-21T12:00:00Z"))).toBe(
      "21. August 2026",
    );
  });
});

describe("invitationEmail()", () => {
  const base = {
    to: "mara@example.com",
    workspaceName: "Acme",
    projectName: null,
    roleName: "Mitarbeiter:in",
    inviterName: "Ada Lovelace",
    expiresAt: new Date("2026-08-21T12:00:00Z"),
    inviteUrl: "https://issues.example.com/invite/abc",
  };

  it("nennt Workspace, Rolle und Einladenden im Betreff und im Text", () => {
    const { subject, text, html } = invitationEmail(base);

    expect(subject).toBe("Einladung zu Acme");
    expect(text).toContain("Ada Lovelace hat dich zu Acme eingeladen");
    expect(text).toContain("Rolle: Mitarbeiter:in");
    expect(text).toContain("https://issues.example.com/invite/abc");
    expect(text).toContain("21. August 2026");
    expect(html).toContain("https://issues.example.com/invite/abc");
  });

  it("nennt zusätzlich das Projekt, wenn die Einladung dort einlädt", () => {
    const { subject, text } = invitationEmail({
      ...base,
      projectName: "Mobile",
    });

    expect(subject).toBe("Einladung zu Mobile (Acme)");
    expect(text).toContain("Projekt: Mobile");
  });

  it("escaped Namen im HTML, lässt den Klartext aber unverändert", () => {
    const { html, text } = invitationEmail({
      ...base,
      workspaceName: "<b>Acme</b>",
    });

    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(text).toContain("<b>Acme</b>");
  });

  it("nutzt einen Admin-Override statt der Default-Texte, mit Platzhaltern", () => {
    const { subject, text } = invitationEmail(base, {
      subject: "Los geht's bei {{workspaceName}}!",
      heading: "Willkommen, {{inviterName}} hat dich eingeladen",
      bodyText: "Schön, dass du bei {{workspaceName}} dabei bist.",
    });

    expect(subject).toBe("Los geht's bei Acme!");
    expect(text).toContain("Willkommen, Ada Lovelace hat dich eingeladen");
    expect(text).toContain("Schön, dass du bei Acme dabei bist.");
  });
});

describe("memberRemovedEmail()", () => {
  const base = {
    to: "mara@example.com",
    workspaceName: "Acme",
    projectName: null,
    actorName: "Ada Lovelace",
  };

  it("nennt den Workspace, wenn projectName fehlt", () => {
    const { subject, text } = memberRemovedEmail(base);

    expect(subject).toBe("Du wurdest aus Acme entfernt");
    expect(text).toContain(
      "Ada Lovelace hat dich aus dem Workspace Acme entfernt",
    );
  });

  it("nennt stattdessen das Projekt, wenn gesetzt", () => {
    const { subject, text } = memberRemovedEmail({
      ...base,
      projectName: "Mobile",
    });

    expect(subject).toBe("Du wurdest aus Mobile (Acme) entfernt");
    expect(text).toContain(
      "Ada Lovelace hat dich aus dem Projekt Mobile entfernt",
    );
    expect(text).toContain("Der Workspace Acme bleibt dir erhalten");
  });

  it("escaped Namen im HTML, lässt den Klartext aber unverändert", () => {
    const { html, text } = memberRemovedEmail({
      ...base,
      workspaceName: "<b>Acme</b>",
    });

    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(text).toContain("<b>Acme</b>");
  });

  it("nutzt einen Admin-Override statt der Default-Texte, mit Platzhaltern", () => {
    const { subject, text } = memberRemovedEmail(base, {
      subject: "Tschüss bei {{workspaceName}}",
      heading: "H",
      bodyText: "{{actorName}} hat dich rausgeworfen.",
    });

    expect(subject).toBe("Tschüss bei Acme");
    expect(text).toContain("Ada Lovelace hat dich rausgeworfen.");
  });
});

describe("notificationEmail()", () => {
  const base = {
    to: "mara@example.com",
    actorLabel: "Ada Lovelace",
    workspaceName: "Acme",
    project: null,
    issue: null,
    url: "https://issues.example.com/ws-1/issue/ACME-1",
    manageUrl: "https://issues.example.com/ws-1/account/notifications",
  };

  it("baut eine Zuweisungs-Mail mit Issue-Bezug", () => {
    const { subject, text } = notificationEmail({
      ...base,
      type: "assigned",
      text: "",
      issue: { identifier: "ACME-1", title: "Login-Fehler beheben" },
    });

    expect(subject).toBe("ACME-1 wurde dir zugewiesen");
    expect(text).toContain("Ada Lovelace hat dir gerade ACME-1");
    expect(text).toContain("Login-Fehler beheben");
  });

  it("baut eine Rollen-Mail ohne Issue-Bezug", () => {
    const { subject, text } = notificationEmail({
      ...base,
      type: "role",
      text: "Admin",
    });

    expect(subject).toBe("Deine Rolle wurde geändert");
    expect(text).toContain("Acme");
    expect(text).toContain("Admin");
  });

  it("zitiert die Kommentar-Vorschau bei `comment`", () => {
    const { html, text } = notificationEmail({
      ...base,
      type: "comment",
      text: "Bitte vor dem Release fixen.",
      issue: { identifier: "ACME-1", title: "Login" },
    });

    expect(html).toContain("Bitte vor dem Release fixen.");
    expect(text).toContain("„Bitte vor dem Release fixen.“");
  });

  it("verlinkt die Benachrichtigungseinstellungen im Fuß", () => {
    const { html } = notificationEmail({
      ...base,
      type: "assigned",
      text: "",
      issue: { identifier: "ACME-1", title: "Login" },
    });

    expect(html).toContain(base.manageUrl);
  });

  it("escaped Titel und Namen im HTML, ohne den Klartext zu verändern", () => {
    const { html, text } = notificationEmail({
      ...base,
      type: "comment",
      text: `<script>alert('x')</script>`,
      issue: { identifier: "ACME-1", title: "Login" },
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("<script>alert('x')</script>");
  });

  it("nutzt einen Admin-Override nur für den betroffenen Anlass", () => {
    const overridden = notificationEmail(
      { ...base, type: "assigned", text: "", issue: null },
      {
        subject: "Neu für dich: {{issueIdentifier}}",
        heading: "Zugewiesen!",
        bodyText: "{{actorLabel}} hat dir etwas zugewiesen.",
      },
    );
    expect(overridden.subject).toBe("Neu für dich: ");
    expect(overridden.text).toContain("Zugewiesen!");
    expect(overridden.text).toContain("Ada Lovelace hat dir etwas zugewiesen.");

    const notOverridden = notificationEmail({
      ...base,
      type: "role",
      text: "Admin",
    });
    expect(notOverridden.subject).toBe("Deine Rolle wurde geändert");
  });
});

describe("welcomeEmail()", () => {
  it("begrüßt mit Namen und verlinkt den Login", () => {
    const { subject, text } = welcomeEmail({
      to: "mara@example.com",
      firstName: "Ada",
      loginUrl: "https://issues.example.com/login",
    });

    expect(subject).toBe("Willkommen beim Issue Tracker");
    expect(text).toContain("Willkommen, Ada");
    expect(text).toContain("https://issues.example.com/login");
  });
});

describe("emailVerificationEmail()", () => {
  it("verlinkt die Bestätigungs-URL im Betreff- und Textkörper", () => {
    const { subject, text, html } = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
    });

    expect(subject).toBe("Bestätige deine E-Mail-Adresse");
    expect(text).toContain("https://issues.example.com/verify/abc");
    expect(html).toContain("https://issues.example.com/verify/abc");
  });

  it("zeigt den Code, wenn einer mitgegeben wird", () => {
    const { html, text } = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
      code: "482917",
    });

    expect(html).toContain("482917");
    expect(text).toContain("Code: 482917");
  });

  it("nennt die Frist nur, wenn eine mitgegeben wird", () => {
    const withoutExpiry = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
    });
    expect(withoutExpiry.text).not.toContain("Stunden");

    const withExpiry = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
      expiresInHours: 24,
    });
    expect(withExpiry.text).toContain("24 Stunden");
  });
});

describe("passwordResetEmail()", () => {
  const base = {
    to: "mara@example.com",
    requestedAt: new Date("2026-08-14T09:41:00Z"),
    expiresInMinutes: 60,
    resetUrl: "https://issues.example.com/reset/abc",
  };

  it("nennt Empfänger, Frist und Link", () => {
    const { subject, text } = passwordResetEmail(base);

    expect(subject).toBe("Passwort zurücksetzen");
    expect(text).toContain("mara@example.com");
    expect(text).toContain("Gültig bis");
    expect(text).toContain("(60 Min.)");
    expect(text).toContain("https://issues.example.com/reset/abc");
  });

  it("zeigt Gerät und Ort nur, wenn mitgegeben", () => {
    const withoutContext = passwordResetEmail(base);
    expect(withoutContext.text).not.toContain("Gerät:");

    const withContext = passwordResetEmail({
      ...base,
      device: "Chrome auf macOS",
      location: "Hamburg, DE",
    });
    expect(withContext.text).toContain("Gerät: Chrome auf macOS");
    expect(withContext.text).toContain("Ort: Hamburg, DE");
  });

  it("verlinkt die Sicherheitseinstellungen in der Warnbox, wenn gesetzt", () => {
    const { html } = passwordResetEmail({
      ...base,
      securityUrl: "https://issues.example.com/ws-1/account/security",
    });
    expect(html).toContain("https://issues.example.com/ws-1/account/security");
  });
});

describe("weeklyDigestEmail()", () => {
  const base = {
    to: "mara@example.com",
    firstName: "Ada",
    workspaceName: "Acme",
    periodLabel: "13.–19. Januar",
    assignedOpenCount: 3,
    completedCount: 5,
    createdCount: 2,
    highlights: [
      {
        identifier: "ACME-1",
        title: "Login-Fehler beheben",
        statusLabel: "Erledigt",
      },
    ],
    url: "https://issues.example.com/ws-1/my",
  };

  it("nennt die erledigte Anzahl im Betreff und die Zähler im Text", () => {
    const { subject, text } = weeklyDigestEmail(base);

    expect(subject).toBe("Deine Woche in Acme: 5 erledigt");
    expect(text).toContain("Dir zugewiesen, offen: 3");
    expect(text).toContain("Erledigt: 5");
    expect(text).toContain("Neu angelegt: 2");
    expect(text).toContain("ACME-1 Login-Fehler beheben (Erledigt)");
  });

  it("kommt ohne Highlights aus", () => {
    const { text } = weeklyDigestEmail({ ...base, highlights: [] });
    expect(text).not.toContain("ACME-1");
  });
});

describe("issueUpdateEmail()", () => {
  it("listet mehrere Feldänderungen einer Bearbeitung", () => {
    const { subject, text } = issueUpdateEmail({
      to: "mara@example.com",
      actorLabel: "Ada Lovelace",
      issue: { identifier: "ACME-1", title: "Login-Fehler beheben" },
      changes: [
        { field: "Priorität", from: "Mittel", to: "Hoch" },
        { field: "Titel", to: "Login-Fehler dringend beheben" },
      ],
      url: "https://issues.example.com/ws-1/issue/ACME-1",
    });

    expect(subject).toBe("ACME-1 wurde aktualisiert");
    expect(text).toContain("Priorität: Mittel → Hoch");
    expect(text).toContain("Titel: Login-Fehler dringend beheben");
  });

  it("escaped Feldwerte im HTML, ohne den Klartext zu verändern", () => {
    const { html, text } = issueUpdateEmail({
      to: "mara@example.com",
      actorLabel: "Ada",
      issue: { identifier: "ACME-1", title: "Login" },
      changes: [{ field: "Titel", to: "<b>Login</b>" }],
      url: "https://issues.example.com/ws-1/issue/ACME-1",
    });

    expect(html).not.toContain("<b>Login</b>");
    expect(html).toContain("&lt;b&gt;Login&lt;/b&gt;");
    expect(text).toContain("<b>Login</b>");
  });
});
