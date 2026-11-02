"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import styles from "./UserMenu.module.css";

export default function UserMenu() {
  const { user, isLoading, isAuthenticated, isPro, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) return null;

  if (!isAuthenticated || !user) {
    return (
      <Link href="/login" className={styles.loginLink}>
        Anmelden
      </Link>
    );
  }

  const displayName =
    (user.profile?.role === "partner" ? user.partnerProfile?.company_name : null) ||
    user.profile?.username ||
    [user.profile?.first_name, user.profile?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email?.split("@")[0] ||
    "Konto";

  const isPartner = user.profile?.role === "partner";
  const base = isPartner ? "/konto/partner" : "/konto/reisender";

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className={styles.avatarFallback}>
          {displayName.charAt(0).toUpperCase()}
        </span>
        <span className={styles.chevron}>{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.userHeader}>
            <span className={styles.userName}>{displayName}</span>
            <span
              className={
                isPro ? styles.userBadgePremium : styles.userBadgeStandard
              }
            >
              {isPartner
                ? isPro
                  ? "★ Partner-Pin Aktiv"
                  : "Partner*in (Basis)"
                : isPro
                  ? "★ Fairführer+"
                  : "Reisende*r"}
            </span>
          </div>
          <div className={styles.divider} />

          {isPartner ? (
            <>
              <Link
                href="/konto/partner/audiopin"
                className={`${styles.item} ${styles.itemHighlight}`}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                <span>{isPro ? "Mein Partner-Pin" : "Mein Audiopin"}</span>
                {isPro && <span className={styles.itemBadge}>Studio</span>}
              </Link>
              <Link
                href={`${base}/profil`}
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Profil
              </Link>
              <Link
                href="/konto/partner/premium"
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                {isPro ? "Partner-Pin Abo" : "Partner-Pin Upgrade"}
              </Link>
              <Link
                href={`${base}/einstellungen`}
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Einstellungen
              </Link>
              <Link
                href="/konto/partner/hilfe"
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Hilfe
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`${base}/profil`}
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Profil
              </Link>
              <Link
                href={`${base}/einstellungen`}
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Einstellungen
              </Link>
              <Link
                href="/konto/reisender/redaktion"
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                PIN erstellen
              </Link>
              <Link
                href="/konto/reisender/premium"
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Fairführer+
              </Link>
              <Link
                href="/konto/reisender/hilfe"
                className={styles.item}
                scroll={false}
                onClick={() => setIsOpen(false)}
              >
                Hilfe
              </Link>
            </>
          )}
          <div className={styles.divider} />
          <button
            type="button"
            className={`${styles.item} ${styles.logout}`}
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
