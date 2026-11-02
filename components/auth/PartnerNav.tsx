"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./KontoNav.module.css";

interface PartnerNavProps {
  initialIsPremium?: boolean;
}

export default function PartnerNav({
  initialIsPremium = false,
}: PartnerNavProps) {
  const pathname = usePathname();
  const { isPro } = useAuth();
  const isPremium = initialIsPremium || isPro;

  const links = [
    {
      href: "/konto/partner/audiopin",
      label: isPremium ? "Mein Partner-Pin" : "Mein Audiopin",
      highlight: true,
    },
    { href: "/konto/partner/profil", label: "Profil" },
    {
      href: "/konto/partner/premium",
      label: isPremium ? "Partner-Pin Abo" : "Partner-Pin Upgrade",
    },
    { href: "/konto/partner/einstellungen", label: "Einstellungen" },
    { href: "/konto/partner/hilfe", label: "Hilfe" },
  ];

  return (
    <nav className={styles.nav} aria-label="Partnerkonto-Navigation">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          scroll={false}
          className={`${styles.navItem} ${pathname === link.href ? styles.navItemActive : ""}`}
        >
          {link.label}
          {link.highlight && isPremium && (
            <span className={styles.navBadge}>Studio</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
