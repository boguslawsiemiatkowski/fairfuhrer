"use client";

import styles from "./PasswordChecklist.module.css";

interface PasswordChecklistProps {
  password: string;
}

const RULES = [
  { id: "len", label: "Mind. 8 Zeichen", test: (pw: string) => pw.length >= 8 },
  { id: "upper", label: "Großbuchstabe (A–Z)", test: (pw: string) => /[A-Z]/.test(pw) },
  { id: "lower", label: "Kleinbuchstabe (a–z)", test: (pw: string) => /[a-z]/.test(pw) },
  { id: "digit", label: "Ziffer (0–9)", test: (pw: string) => /[0-9]/.test(pw) },
  { id: "special", label: "Sonderzeichen (!@#…)", test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
] as const;

export default function PasswordChecklist({ password }: PasswordChecklistProps) {
  return (
    <ul className={styles.list} aria-label="Passwortanforderungen">
      {RULES.map((rule) => {
        const met = password.length > 0 && rule.test(password);
        return (
          <li
            key={rule.id}
            className={`${styles.item} ${met ? styles.itemMet : ""}`}
          >
            <span className={styles.icon} aria-hidden="true">
              {met ? "✓" : "○"}
            </span>
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
