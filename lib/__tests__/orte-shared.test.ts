import { describe, expect, it } from "vitest";
import {
  cityToSegment,
  distanceInMeters,
  formatDistance,
  htmlToPlainText,
  normalizeForSearch,
  pickDiscovery,
  sanitizeExternalUrl,
  sanitizeWordHtml,
  truncateAtWord,
} from "@/lib/orte-shared";

describe("sanitizeWordHtml", () => {
  it("erlaubt sichere Formatierungs-Tags und entfernt alle Attribute", () => {
    const dirty =
      '<p class="MsoNormal" onclick="alert(1)"><strong onmouseover="evil()">Hallo</strong> <em>Welt</em></p>';
    expect(sanitizeWordHtml(dirty)).toBe(
      "<p><strong>Hallo</strong> <em>Welt</em></p>"
    );
  });

  it("entfernt gefährliche Tags wie <script>, <iframe>, <svg>, <style>", () => {
    const dirty =
      '<p>Text</p><script>alert("xss")</script><iframe src="https://evil.com"></iframe><svg onload="alert(1)">';
    expect(sanitizeWordHtml(dirty)).toBe('<p>Text</p>alert("xss")');
  });

  it("erlaubt sichere https/http/mailto/tel Links in <a> und ergänzt rel/target", () => {
    const dirty =
      '<p><a href="https://fairfuehrer.guide/test" onclick="steal()">Link</a></p>';
    expect(sanitizeWordHtml(dirty)).toBe(
      '<p><a href="https://fairfuehrer.guide/test" target="_blank" rel="noopener noreferrer">Link</a></p>'
    );
  });

  it("blockiert javascript: und data: URLs in <a href>", () => {
    const dirty =
      '<p><a href="javascript:alert(document.cookie)">Klick</a> <a href="data:text/html,<script>alert(1)</script>">Data</a></p>';
    expect(sanitizeWordHtml(dirty)).toBe(
      "<p><a>Klick</a> <a>Data</a></p>"
    );
  });

  it("entfernt Word-Kommentare, mehrfache &nbsp; und leere Absätze", () => {
    const dirty =
      "<!--[if gte mso 9]><xml></xml><![endif]--><p>&nbsp;&nbsp;</p><p>Inhalt&nbsp;hier</p>";
    expect(sanitizeWordHtml(dirty)).toBe("<p>Inhalt hier</p>");
  });
});

describe("sanitizeExternalUrl", () => {
  it("akzeptiert gültige https:// und http:// URLs", () => {
    expect(sanitizeExternalUrl("https://fairfuehrer.guide/karte")).toBe(
      "https://fairfuehrer.guide/karte"
    );
    expect(sanitizeExternalUrl("http://beispiel.de")).toBe(
      "http://beispiel.de"
    );
  });

  it("ergänzt https://, wenn kein Protokoll angegeben wurde", () => {
    expect(sanitizeExternalUrl("www.fairfuehrer.guide")).toBe(
      "https://www.fairfuehrer.guide"
    );
    expect(sanitizeExternalUrl("  beispiel.de/pfad  ")).toBe(
      "https://beispiel.de/pfad"
    );
  });

  it("weist gefährliche Protokolle (javascript:, data:, vbscript:, file:) zurück", () => {
    expect(sanitizeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeExternalUrl("JAVASCRIPT:alert(1)")).toBeUndefined();
    expect(
      sanitizeExternalUrl("data:text/html,<script>alert(1)</script>")
    ).toBeUndefined();
    expect(sanitizeExternalUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(sanitizeExternalUrl("file:///etc/passwd")).toBeUndefined();
  });

  it("gibt undefined bei leeren Eingaben zurück", () => {
    expect(sanitizeExternalUrl("")).toBeUndefined();
    expect(sanitizeExternalUrl("   ")).toBeUndefined();
    expect(sanitizeExternalUrl(null)).toBeUndefined();
    expect(sanitizeExternalUrl(undefined)).toBeUndefined();
  });
});

describe("htmlToPlainText", () => {
  it("wandelt HTML und benannte/numerische Entities in reinen Text um", () => {
    const html =
      "<p>Sch&ouml;ne &bdquo;Aussicht&ldquo; &ndash; 100&#160;m &amp; &#x20AC;5</p>";
    expect(htmlToPlainText(html)).toBe("Schöne „Aussicht“ – 100 m & €5");
  });
});

describe("Geografie & URL-Hilfsfunktionen", () => {
  it("cityToSegment formt Städtenamen mit Umlauten in URL-Segmente um", () => {
    expect(cityToSegment("Bad Wörishofen")).toBe("bad-woerishofen");
    expect(cityToSegment("Überlingen am Bodensee")).toBe(
      "ueberlingen-am-bodensee"
    );
    expect(cityToSegment("Füssen / Allgäu")).toBe("fuessen-allgaeu");
  });

  it("normalizeForSearch gleicht Umlaute und Groß-/Kleinschreibung an", () => {
    expect(normalizeForSearch("Allgäuer Käseküche")).toBe(
      "allgauer kasekuche"
    );
  });

  it("distanceInMeters und formatDistance berechnen realistische Distanzen", () => {
    // Konstanz -> Meersburg (~8 km Luftlinie)
    const meters = distanceInMeters([9.175, 47.66], [9.271, 47.694]);
    expect(meters).toBeGreaterThan(7500);
    expect(meters).toBeLessThan(9000);
    expect(formatDistance(450)).toBe("450 m");
    expect(formatDistance(1540)).toBe("1,5 km");
  });

  it("pickDiscovery wählt deterministisch einen Ort im Ring 400 m .. 12 km", () => {
    const origin = {
      slug: "ursprung",
      Stadt: "Konstanz",
      location: { coordinates: [9.175, 47.66] as [number, number] },
    };
    const tooClose = {
      slug: "zu-nah",
      Stadt: "Konstanz",
      location: { coordinates: [9.1755, 47.6602] as [number, number] },
    };
    const inRing = {
      slug: "meersburg-schloss",
      Stadt: "Meersburg",
      location: { coordinates: [9.271, 47.694] as [number, number] },
    };

    const result = pickDiscovery(origin, [origin, tooClose, inRing]);
    expect(result).not.toBeNull();
    expect(result?.place.slug).toBe("meersburg-schloss");
  });

  it("truncateAtWord kürzt sauber an einer Wortgrenze", () => {
    expect(
      truncateAtWord("Dies ist ein längerer Beispieltext für den Teaser", 25)
    ).toBe("Dies ist ein längerer…");
  });
});

