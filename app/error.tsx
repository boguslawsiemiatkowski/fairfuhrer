// app/error.tsx
"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import ErrorScreen, {
  ErrorScreenButton,
  ErrorScreenLink,
} from "../components/ErrorScreen";
import { reportError } from "../lib/reportError";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, "Route error boundary");
  }, [error]);

  return (
    <ErrorScreen
      title="Etwas ist schiefgelaufen"
      message="Beim Laden dieser Seite ist ein unerwarteter Fehler aufgetreten."
      hint="Bitte versuchen Sie es erneut. Falls das Problem weiterhin besteht, schreiben Sie uns an info@fairfuehrer.guide."
      digest={error.digest}
    >
      <ErrorScreenButton onClick={() => unstable_retry()}>
        Erneut versuchen
      </ErrorScreenButton>
      <ErrorScreenLink href="/">Zur Startseite</ErrorScreenLink>
    </ErrorScreen>
  );
}
