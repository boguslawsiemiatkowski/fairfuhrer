import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";
import KontoHeader from "@/components/auth/KontoHeader";
import ReisenderNav from "@/components/auth/ReisenderNav";
import { isPremiumActiveForDates } from "@/types/auth";
import styles from "../konto.module.css";

export default async function ReisenderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role === "partner") redirect("/konto/partner");

  const { profile } = user;
  const displayName =
    profile?.username ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user.email ||
    "Benutzer";

  const isPremium = isPremiumActiveForDates(profile?.premium_until);

  return (
    <div className={styles.main}>
      <KontoHeader
        isPartner={false}
        displayName={displayName}
        isPremium={isPremium}
      />

      <div className={styles.divider} />

      <ReisenderNav isPremium={isPremium} />

      <div className={styles.content}>{children}</div>
    </div>
  );
}
