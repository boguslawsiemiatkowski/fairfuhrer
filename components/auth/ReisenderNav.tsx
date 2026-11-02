"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./KontoNav.module.css";

interface Props {
  isPremium?: boolean;
}

export default function ReisenderNav({ isPremium = false }: Props) {
  const pathname = usePathname();

  const links = [
    { href: "/konto/reisender/profil", label: "Profil" },
    { href: "/konto/reisender/einstellungen", label: "Einstellungen" },
    { href: "/konto/reisender/redaktion", label: "PIN erstellen" },
    {
      href: "/konto/reisender/premium",
      label: "Fairführer+",
      badge: isPremium ? "Aktiv" : undefined,
    },
    { href: "/konto/reisender/hilfe", label: "Hilfe" },
  ];

  return (
    <nav className={styles.nav}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          scroll={false}
          className={`${styles.navItem} ${pathname === link.href ? styles.navItemActive : ""}`}
        >
          {link.label}
          {link.badge && <span className={styles.navBadge}>{link.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
