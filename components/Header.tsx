"use client";

import styles from "./Header.module.css";
import Image from "next/image";
import Link from "next/link";
import UserMenu from "./auth/UserMenu";
import { useState, useEffect } from "react";
import logoFairfuehrer from "../public/logo-fairfuehrer.png";
import appStoreBadge from "../public/app-store-badge.svg";
import googlePlayBadge from "../public/android-store-badge.svg";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Link href="/">
          <Image
            src={logoFairfuehrer}
            alt="Fair Guide Logo"
            priority
            unoptimized
            style={{
              width: "232px",
              height: "auto",
            }}
          />
        </Link>
      </div>

      {/* Desktop Navigation */}
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLink}>
          Home
        </Link>
        <Link href="/karte" className={styles.navLink}>
          Karte
        </Link>
        <Link href="/liste" className={styles.navLink}>
          Liste
        </Link>
        <Link href="/partner-werden" className={styles.navLink}>
          Mitmachen
        </Link>
        <Link href="/ueber-uns" className={styles.navLink}>
          Über uns
        </Link>

        <UserMenu />

        {/* Social media - Desktop */}
        <div className={styles.social}>
          <a
            href="https://www.instagram.com/fairfuehrer/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Instagram"
          >
            <svg
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61561084330676"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Facebook"
          >
            <svg
              width="26"
              height="26"
              fill="currentColor"
              viewBox="0 0 320 512"
            >
              <path d="M279.14 288l14.22-92.66h-88.91V127.45c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
            </svg>
          </a>
        </div>
      </nav>
      {/* UserMenu w headerze — widoczny na mobile, ukryty na desktop (desktop ma go w nav) */}
      <div className={styles.mobileHeaderUserMenu}>
        <UserMenu />
      </div>

      {/* Hamburger Button */}
      <button
        type="button"
        className={`${styles.hamburger} ${
          isMenuOpen ? styles.hamburgerOpen : ""
        }`}
        onClick={toggleMenu}
        onTouchStart={(e) => e.preventDefault()}
        aria-label="Toggle menu"
      >
        <span className={styles.hamburgerLine}></span>
        <span className={styles.hamburgerLine}></span>
        <span className={styles.hamburgerLine}></span>
      </button>

      {/* Mobile Menu */}
      <div
        className={`${styles.mobileMenu} ${
          isMenuOpen ? styles.mobileMenuOpen : ""
        }`}
      >
        <nav className={styles.mobileNav}>
          <Link href="/" className={styles.mobileNavLink} onClick={closeMenu}>
            Home
          </Link>
          <Link
            href="/karte"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Karte
          </Link>
          <Link
            href="/liste"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Liste
          </Link>
          <Link
            href="/partner-werden"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Mitmachen
          </Link>
          <Link
            href="/ueber-uns"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Über uns
          </Link>
          <Link
            href="/impressum"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Impressum
          </Link>
          <Link
            href="/agb"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            AGB
          </Link>
          <Link
            href="/datenschutz"
            className={styles.mobileNavLink}
            onClick={closeMenu}
          >
            Datenschutz
          </Link>
        </nav>

        {/* Store Badges - Mobile */}
        <div className={styles.mobileStoreBadges}>
          <span className={styles.mobileStoreBadgesLabel}>Jetzt verfügbar</span>
          <div className={styles.mobileStoreBadgesIcons}>
            <a
              href="https://apps.apple.com/de/app/fairf%C3%BChrer/id6778095803"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              aria-label="Fairführer im App Store öffnen"
            >
              <Image
                src={appStoreBadge}
                alt="App Store"
                unoptimized
                className={styles.mobileStoreBadgeImg}
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.fairfuehrer.app"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              aria-label="Fairführer bei Google Play öffnen"
            >
              <Image
                src={googlePlayBadge}
                alt="Google Play"
                unoptimized
                className={styles.mobileStoreBadgeImg}
              />
            </a>
          </div>
        </div>

        {/* Social media - Mobile */}
        <div className={styles.mobileSocial}>
          <a
            href="https://www.instagram.com/fairfuehrer/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Instagram"
          >
            <svg
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61561084330676"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialIcon}
            aria-label="Facebook"
          >
            <svg
              width="26"
              height="26"
              fill="currentColor"
              viewBox="0 0 320 512"
            >
              <path d="M279.14 288l14.22-92.66h-88.91V127.45c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
