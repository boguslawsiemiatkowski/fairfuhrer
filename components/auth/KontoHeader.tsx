"use client";

import styles from "@/app/(protected)/konto/konto.module.css";

interface Props {
  isPartner: boolean;
  displayName: string;
  isPremium?: boolean;
}

export default function KontoHeader({
  isPartner,
  displayName,
  isPremium = false,
}: Props) {
  return (
    <div className={styles.header}>
      <div className={styles.headerWelcome}>
        <div className={styles.roleBadges}>
          <span className={styles.role}>
            {isPartner ? "Partner*in" : "Reisende*r"}
          </span>
          {isPartner && (
            <span
              className={
                isPremium ? styles.roleBadgePremium : styles.roleBadgeStandard
              }
            >
              {isPremium ? "★ Partner-Pin Aktiv" : "Basis-Konto"}
            </span>
          )}
        </div>
        <h1 className={styles.greeting}>Willkommen {displayName}!</h1>
      </div>
    </div>
  );
}
