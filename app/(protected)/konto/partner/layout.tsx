import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";
import KontoHeader from "@/components/auth/KontoHeader";
import PartnerNav from "@/components/auth/PartnerNav";
import { isPremiumActiveForDates } from "@/types/auth";
import styles from "../konto.module.css";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "partner") redirect("/konto/reisender");

  const displayName =
    user.partnerProfile?.company_name || user.email || "Partner";

  // Sprawdzamy status Partner-Pin z obu tabel (profiles i partner_profiles)
  const isPremium = isPremiumActiveForDates(
    user.profile?.premium_until,
    user.partnerProfile?.premium_until,
  );

  return (
    <div className={styles.main}>
      <KontoHeader
        isPartner={true}
        displayName={displayName}
        isPremium={isPremium}
      />

      <div className={styles.divider} />

      <PartnerNav initialIsPremium={isPremium} />

      <div className={styles.content}>{children}</div>
    </div>
  );
}
