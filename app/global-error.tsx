// app/global-error.tsx
"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { reportError } from "../lib/reportError";

/**
 * Ostatnia linia obrony — łapie błędy z root layoutu, których nie może złapać
 * app/error.tsx. Zastępuje cały dokument, więc nie ma tu dostępu do
 * reset.css ani do zmiennych fontów z layoutu. Dlatego style są inline,
 * a typografia opiera się na systemowym stacku.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, "Global error boundary");
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fdf6e3",
          color: "#333",
          fontFamily:
            "'Fira Sans Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          lineHeight: 1.6,
        }}
      >
        <title>Fehler | FAIRFÜHRER</title>
        <main
          style={{
            maxWidth: "600px",
            padding: "2rem 1rem",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 400,
              lineHeight: 1.2,
              color: "#1a1a1a",
              textTransform: "uppercase",
              margin: "0 0 1rem 0",
            }}
          >
            Ein schwerwiegender Fehler ist aufgetreten
          </h1>
          <p style={{ fontSize: "1.125rem", color: "#495057", margin: "0 0 0.75rem 0" }}>
            Die Seite konnte nicht geladen werden.
          </p>
          <p style={{ fontSize: "0.9375rem", color: "#6c757d", margin: 0 }}>
            Bitte versuchen Sie es erneut. Falls das Problem weiterhin besteht,
            schreiben Sie uns an{" "}
            <a href="mailto:info@fairfuehrer.guide" style={{ color: "#fc6c14" }}>
              info@fairfuehrer.guide
            </a>
            .
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "2.5rem",
              padding: "0.75rem 1.75rem",
              fontSize: "1rem",
              fontWeight: 500,
              fontFamily: "inherit",
              color: "#ffffff",
              backgroundColor: "#fc6c14",
              border: "2px solid #fc6c14",
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
          {error.digest && (
            <p style={{ marginTop: "2.5rem", fontSize: "0.8125rem", color: "#6c757d" }}>
              Fehlercode: <code style={{ fontFamily: "monospace" }}>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
