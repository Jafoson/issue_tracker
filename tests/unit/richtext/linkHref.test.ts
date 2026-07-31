import { describe, expect, test } from "bun:test";
import { toHref } from "@/components/ui/layout/RichTextEditor/components/LinkForm/LinkForm";
import { faviconOf, faviconStyle, hostOf } from "@/lib/richtext/link";

/**
 * Was aus einer getippten Adresse wird, bevor sie im Dokument landet.
 *
 * Zwei Aufgaben: das fehlende Schema ergänzen — wer einen Link setzt, tippt
 * selten `https://` mit — und alles ablehnen, was im Browser gefährlich wäre.
 * Zusammen mit `safeUrl` in `RichText` ist das die zweite Reihe: hier kommt es
 * gar nicht erst ins Dokument, dort wird es beim Anzeigen noch einmal geprüft.
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
    // Mit Schema bleibt sie, wie sie ist.
    expect(toHref("mailto:anna@example.com")).toBe("mailto:anna@example.com");
  });

  test("lässt anwendungsinterne Ziele durch", () => {
    expect(toHref("/issues/ORB-42")).toBe("/issues/ORB-42");
    expect(toHref("#abschnitt")).toBe("#abschnitt");
  });

  test("lehnt gefährliche Schemata ab, statt sie zu ergänzen", () => {
    // Der Kern: aus `javascript:` darf niemals `https://javascript:…` werden.
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
    // Bewusst kein fremder Dienst: der bekäme sonst jede verlinkte Adresse
    // zu sehen.
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
    // Anführungszeichen könnten aus dem Attribut ausbrechen — der URL-Parser
    // lässt sie im Host nicht zu, kodiert werden sie trotzdem.
    expect(faviconStyle('https://ex"ample.com')).not.toContain('"ample');
  });
});
