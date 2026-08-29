import { describe, expect, test } from "bun:test";
import { toHref } from "@/components/ui/layout/RichTextEditor/components/LinkForm/LinkForm";
import { faviconOf, faviconStyle, hostOf } from "@/lib/richtext/link";

/**
 * What a typed address turns into before it lands in the document.
 *
 * Two jobs: fill in the missing scheme — someone setting a link rarely types
 * `https://` along with it — and reject anything that would be dangerous in
 * the browser. Together with `safeUrl` in `RichText`, this is the second line
 * of defense: here it never makes it into the document in the first place,
 * there it's checked again at display time.
 */

describe("toHref", () => {
  test("lässt vollständige Adressen unangetastet", () => {
    expect(toHref("https://example.com")).toBe("https://example.com");
    expect(toHref("http://example.com/a?b=c")).toBe("http://example.com/a?b=c");
  });

  test("ergänzt das fehlende Schema", () => {
    expect(toHref("example.com")).toBe("https://example.com");
    expect(toHref("www.example.com/pfad")).toBe("https://www.example.com/pfad");
  });

  test("erkennt eine Mailadresse", () => {
    expect(toHref("anna@example.com")).toBe("mailto:anna@example.com");
    // With a scheme already present, it stays as is.
    expect(toHref("mailto:anna@example.com")).toBe("mailto:anna@example.com");
  });

  test("lässt anwendungsinterne Ziele durch", () => {
    expect(toHref("/issues/ORB-42")).toBe("/issues/ORB-42");
    expect(toHref("#abschnitt")).toBe("#abschnitt");
  });

  test("lehnt gefährliche Schemata ab, statt sie zu ergänzen", () => {
    // The core rule: `javascript:` must never become `https://javascript:…`.
    expect(toHref("javascript:alert(1)")).toBeNull();
    expect(toHref("JavaScript:alert(1)")).toBeNull();
    expect(toHref("data:text/html;base64,PHN2Zz4=")).toBeNull();
    expect(toHref("vbscript:msgbox")).toBeNull();
    expect(toHref("file:///etc/passwd")).toBeNull();
  });

  test("gibt für leere Eingaben nichts zurück", () => {
    expect(toHref("")).toBeNull();
    expect(toHref("   ")).toBeNull();
  });

  test("stört sich nicht an Leerzeichen am Rand", () => {
    expect(toHref("  example.com  ")).toBe("https://example.com");
  });
});

describe("hostOf / faviconOf", () => {
  test("nimmt den Hostnamen als Ersatznamen — ohne www", () => {
    expect(hostOf("https://www.example.com/a/b")).toBe("example.com");
    expect(hostOf("https://docs.example.com")).toBe("docs.example.com");
  });

  test("leitet das Icon von der Seite selbst ab", () => {
    // Deliberately no third-party service: it would otherwise get to see
    // every linked address.
    expect(faviconOf("https://example.com/tief/drin?a=b")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(faviconOf("http://example.com:8080/x")).toBe(
      "http://example.com:8080/favicon.ico",
    );
  });

  test("gibt für Adressen ohne Host kein Icon zurück", () => {
    expect(faviconOf("mailto:anna@example.com")).toBeNull();
    expect(faviconOf("/issues/ORB-42")).toBeNull();
    expect(faviconOf("#abschnitt")).toBeNull();
    expect(faviconOf("kein-link")).toBeNull();
  });

  test("baut ein `style`-Attribut, das nichts einschleusen kann", () => {
    const style = faviconStyle("https://example.com");
    expect(style).toBe('--favicon: url("https://example.com/favicon.ico")');
    // Quotes could break out of the attribute — the URL parser doesn't allow
    // them in the host, but they get encoded regardless.
    expect(faviconStyle('https://ex"ample.com')).not.toContain('"ample');
  });
});
