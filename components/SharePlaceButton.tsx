// components/SharePlaceButton.tsx
// Przycisk udostępniania miejsca („Ort teilen”) — korzysta z natywnego Web Share API
// na urządzeniach mobilnych, a na desktopie kopiuje bezpośredni adres URL do schowka.
"use client";

import { useState, useCallback } from "react";
import { Share2, Check } from "lucide-react";
import styles from "./SharePlaceButton.module.css";

interface SharePlaceButtonProps {
  title: string;
  city?: string;
}

export default function SharePlaceButton({
  title,
  city,
}: SharePlaceButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const shareUrl = window.location.href;
    const shareTitle = city ? `${title} (${city}) — FairFührer` : `${title} — FairFührer`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        });
        return;
      } catch (err: unknown) {
        // Jeśli użytkownik anulował natywne okno udostępniania, nic nie robimy
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Ignorujemy błąd braku uprawnień do schowka
    }
  }, [title, city]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`${styles.shareButton} ${copied ? styles.shareButtonCopied : ""}`}
      title={copied ? "Link in die Zwischenablage kopiert" : "Link zu diesem Ort teilen oder kopieren"}
      aria-live="polite"
    >
      {copied ? (
        <>
          <Check size={15} aria-hidden="true" />
          <span>Link kopiert!</span>
        </>
      ) : (
        <>
          <Share2 size={15} aria-hidden="true" />
          <span>Ort teilen</span>
        </>
      )}
    </button>
  );
}
