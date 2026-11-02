"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { MoveLeft } from "lucide-react";

export const LAST_LISTE_URL_KEY = "fairfuehrer:lastListeUrl";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Waliduje zapisany w sessionStorage adres powrotny do widoku `/liste`,
 * dopuszczając wyłącznie `/liste` oraz `/liste?...` (z filtrami miasta, kategorii i kraju).
 */
export function sanitizeSavedListeUrl(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/liste";
  const trimmed = raw.trim();
  if (trimmed === "/liste" || trimmed.startsWith("/liste?")) {
    return trimmed;
  }
  return "/liste";
}

function getClientSnapshot(): string {
  try {
    return sanitizeSavedListeUrl(sessionStorage.getItem(LAST_LISTE_URL_KEY));
  } catch {
    return "/liste";
  }
}

function getServerSnapshot(): string {
  return "/liste";
}

interface BackToListeLinkProps {
  className?: string;
  labelClassName?: string;
}

/**
 * Strzałka powrotu w lewej kolumnie strony Audiopinu (`/liste/[stadt]/[slug]`).
 * Przywraca ostatnio wybrane przez użytkownika filtry na `/liste` (miasto, kategoria, kraj).
 */
export default function BackToListeLink({
  className,
  labelClassName,
}: BackToListeLinkProps) {
  const backHref = useSyncExternalStore(
    subscribeToStorage,
    getClientSnapshot,
    getServerSnapshot,
  );

  return (
    <Link href={backHref} className={className}>
      <MoveLeft size={26} aria-hidden="true" />
      <span className={labelClassName}>Zurück zur Liste</span>
    </Link>
  );
}

