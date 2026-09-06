import { describe, expect, it } from "bun:test";
import { emailVerificationEmail } from "@/lib/mail/templates/emailVerification";
import { escapeHtml, formatDate, humanizeKey } from "@/lib/mail/templates/html";
import { invitationEmail } from "@/lib/mail/templates/invitation";
import { issueUpdateEmail } from "@/lib/mail/templates/issueUpdate";
import { memberRemovedEmail } from "@/lib/mail/templates/memberRemoved";
import { notificationEmail } from "@/lib/mail/templates/notification";
import { passwordResetEmail } from "@/lib/mail/templates/passwordReset";
import { weeklyDigestEmail } from "@/lib/mail/templates/weeklyDigest";
import { welcomeEmail } from "@/lib/mail/templates/welcome";

describe("escapeHtml()", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;",
    );
  });
});

describe("humanizeKey()", () => {
  it("turns a status key into readable text", () => {
    expect(humanizeKey("in_progress")).toBe("In progress");
    expect(humanizeKey("todo")).toBe("Todo");
  });
});

describe("formatDate()", () => {
  it("formats fixed to English, independent of the server locale", () => {
    expect(formatDate(new Date("2026-08-21T12:00:00Z"))).toBe(
      "August 21, 2026",
    );
  });
});

describe("invitationEmail()", () => {
  const base = {
    to: "mara@example.com",
    workspaceName: "Acme",
    projectName: null,
    roleName: "Member",
    inviterName: "Ada Lovelace",
    expiresAt: new Date("2026-08-21T12:00:00Z"),
    inviteUrl: "https://issues.example.com/invite/abc",
  };

  it("names workspace, role, and inviter in the subject and the text", () => {
    const { subject, text, html } = invitationEmail(base);

    expect(subject).toBe("Invitation to Acme");
    expect(text).toContain("Ada Lovelace invited you to Acme");
    expect(text).toContain("Role: Member");
    expect(text).toContain("https://issues.example.com/invite/abc");
    expect(text).toContain("August 21, 2026");
    expect(html).toContain("https://issues.example.com/invite/abc");
  });

  it("also names the project when the invitation is into one", () => {
    const { subject, text } = invitationEmail({
      ...base,
      projectName: "Mobile",
    });

    expect(subject).toBe("Invitation to Mobile (Acme)");
    expect(text).toContain("Project: Mobile");
  });

  it("escapes names in the HTML but leaves the plain text unchanged", () => {
    const { html, text } = invitationEmail({
      ...base,
      workspaceName: "<b>Acme</b>",
    });

    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(text).toContain("<b>Acme</b>");
  });

  it("uses an admin override instead of the default texts, with placeholders", () => {
    const { subject, text } = invitationEmail(base, {
      subject: "Let's go at {{workspaceName}}!",
      heading: "Welcome, {{inviterName}} invited you",
      bodyText: "Glad you're joining {{workspaceName}}.",
    });

    expect(subject).toBe("Let's go at Acme!");
    expect(text).toContain("Welcome, Ada Lovelace invited you");
    expect(text).toContain("Glad you're joining Acme.");
  });
});

describe("memberRemovedEmail()", () => {
  const base = {
    to: "mara@example.com",
    workspaceName: "Acme",
    projectName: null,
    actorName: "Ada Lovelace",
  };

  it("names the workspace when projectName is missing", () => {
    const { subject, text } = memberRemovedEmail(base);

    expect(subject).toBe("You were removed from Acme");
    expect(text).toContain("Ada Lovelace removed you from the workspace Acme");
  });

  it("names the project instead when set", () => {
    const { subject, text } = memberRemovedEmail({
      ...base,
      projectName: "Mobile",
    });

    expect(subject).toBe("You were removed from Mobile (Acme)");
    expect(text).toContain("Ada Lovelace removed you from the project Mobile");
    expect(text).toContain("You keep access to the workspace Acme");
  });

  it("escapes names in the HTML but leaves the plain text unchanged", () => {
    const { html, text } = memberRemovedEmail({
      ...base,
      workspaceName: "<b>Acme</b>",
    });

    expect(html).not.toContain("<b>Acme</b>");
    expect(html).toContain("&lt;b&gt;Acme&lt;/b&gt;");
    expect(text).toContain("<b>Acme</b>");
  });

  it("uses an admin override instead of the default texts, with placeholders", () => {
    const { subject, text } = memberRemovedEmail(base, {
      subject: "Bye from {{workspaceName}}",
      heading: "H",
      bodyText: "{{actorName}} kicked you out.",
    });

    expect(subject).toBe("Bye from Acme");
    expect(text).toContain("Ada Lovelace kicked you out.");
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

  it("builds an assignment email with an issue reference", () => {
    const { subject, text } = notificationEmail({
      ...base,
      type: "assigned",
      text: "",
      issue: { identifier: "ACME-1", title: "Fix login error" },
    });

    expect(subject).toBe("ACME-1 was assigned to you");
    expect(text).toContain("Ada Lovelace just assigned ACME-1");
    expect(text).toContain("Fix login error");
  });

  it("builds a role email without an issue reference", () => {
    const { subject, text } = notificationEmail({
      ...base,
      type: "role",
      text: "Admin",
    });

    expect(subject).toBe("Your role was changed");
    expect(text).toContain("Acme");
    expect(text).toContain("Admin");
  });

  it("quotes the comment preview for `comment`", () => {
    const { html, text } = notificationEmail({
      ...base,
      type: "comment",
      text: "Please fix before release.",
      issue: { identifier: "ACME-1", title: "Login" },
    });

    expect(html).toContain("Please fix before release.");
    expect(text).toContain('"Please fix before release."');
  });

  it("links the notification settings in the footer", () => {
    const { html } = notificationEmail({
      ...base,
      type: "assigned",
      text: "",
      issue: { identifier: "ACME-1", title: "Login" },
    });

    expect(html).toContain(base.manageUrl);
  });

  it("escapes title and names in the HTML without changing the plain text", () => {
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

  it("uses an admin override only for the affected occasion", () => {
    const overridden = notificationEmail(
      { ...base, type: "assigned", text: "", issue: null },
      {
        subject: "New for you: {{issueIdentifier}}",
        heading: "Assigned!",
        bodyText: "{{actorLabel}} assigned you something.",
      },
    );
    expect(overridden.subject).toBe("New for you: ");
    expect(overridden.text).toContain("Assigned!");
    expect(overridden.text).toContain("Ada Lovelace assigned you something.");

    const notOverridden = notificationEmail({
      ...base,
      type: "role",
      text: "Admin",
    });
    expect(notOverridden.subject).toBe("Your role was changed");
  });
});

describe("welcomeEmail()", () => {
  it("greets by name and links to sign-in", () => {
    const { subject, text } = welcomeEmail({
      to: "mara@example.com",
      firstName: "Ada",
      loginUrl: "https://issues.example.com/login",
    });

    expect(subject).toBe("Welcome to Barynt");
    expect(text).toContain("Welcome, Ada");
    expect(text).toContain("https://issues.example.com/login");
  });
});

describe("emailVerificationEmail()", () => {
  it("links the confirmation URL in the subject and body", () => {
    const { subject, text, html } = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
    });

    expect(subject).toBe("Confirm your email address");
    expect(text).toContain("https://issues.example.com/verify/abc");
    expect(html).toContain("https://issues.example.com/verify/abc");
  });

  it("shows the code when one is supplied", () => {
    const { html, text } = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
      code: "482917",
    });

    expect(html).toContain("482917");
    expect(text).toContain("Code: 482917");
  });

  it("names the deadline only when one is supplied", () => {
    const withoutExpiry = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
    });
    expect(withoutExpiry.text).not.toContain("hours");

    const withExpiry = emailVerificationEmail({
      to: "mara@example.com",
      firstName: "Ada",
      verifyUrl: "https://issues.example.com/verify/abc",
      expiresInHours: 24,
    });
    expect(withExpiry.text).toContain("24 hours");
  });
});

describe("passwordResetEmail()", () => {
  const base = {
    to: "mara@example.com",
    requestedAt: new Date("2026-08-14T09:41:00Z"),
    expiresInMinutes: 60,
    resetUrl: "https://issues.example.com/reset/abc",
  };

  it("names recipient, deadline, and link", () => {
    const { subject, text } = passwordResetEmail(base);

    expect(subject).toBe("Reset your password");
    expect(text).toContain("mara@example.com");
    expect(text).toContain("Valid until");
    expect(text).toContain("(60 min)");
    expect(text).toContain("https://issues.example.com/reset/abc");
  });

  it("shows device and location only when supplied", () => {
    const withoutContext = passwordResetEmail(base);
    expect(withoutContext.text).not.toContain("Device:");

    const withContext = passwordResetEmail({
      ...base,
      device: "Chrome on macOS",
      location: "Hamburg, DE",
    });
    expect(withContext.text).toContain("Device: Chrome on macOS");
    expect(withContext.text).toContain("Location: Hamburg, DE");
  });

  it("links the security settings in the alert box when set", () => {
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
    periodLabel: "Jan 13–19",
    assignedOpenCount: 3,
    completedCount: 5,
    createdCount: 2,
    highlights: [
      {
        identifier: "ACME-1",
        title: "Fix login error",
        statusLabel: "Done",
      },
    ],
    url: "https://issues.example.com/ws-1/my",
  };

  it("names the completed count in the subject and the counters in the text", () => {
    const { subject, text } = weeklyDigestEmail(base);

    expect(subject).toBe("Your week in Acme: 5 completed");
    expect(text).toContain("Assigned to you, open: 3");
    expect(text).toContain("Completed: 5");
    expect(text).toContain("Newly created: 2");
    expect(text).toContain("ACME-1 Fix login error (Done)");
  });

  it("works without highlights", () => {
    const { text } = weeklyDigestEmail({ ...base, highlights: [] });
    expect(text).not.toContain("ACME-1");
  });
});

describe("issueUpdateEmail()", () => {
  it("lists several field changes from one edit", () => {
    const { subject, text } = issueUpdateEmail({
      to: "mara@example.com",
      actorLabel: "Ada Lovelace",
      issue: { identifier: "ACME-1", title: "Fix login error" },
      changes: [
        { field: "Priority", from: "Medium", to: "High" },
        { field: "Title", to: "Urgently fix login error" },
      ],
      url: "https://issues.example.com/ws-1/issue/ACME-1",
    });

    expect(subject).toBe("ACME-1 was updated");
    expect(text).toContain("Priority: Medium → High");
    expect(text).toContain("Title: Urgently fix login error");
  });

  it("escapes field values in the HTML without changing the plain text", () => {
    const { html, text } = issueUpdateEmail({
      to: "mara@example.com",
      actorLabel: "Ada",
      issue: { identifier: "ACME-1", title: "Login" },
      changes: [{ field: "Title", to: "<b>Login</b>" }],
      url: "https://issues.example.com/ws-1/issue/ACME-1",
    });

    expect(html).not.toContain("<b>Login</b>");
    expect(html).toContain("&lt;b&gt;Login&lt;/b&gt;");
    expect(text).toContain("<b>Login</b>");
  });
});
