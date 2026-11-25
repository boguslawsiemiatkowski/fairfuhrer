import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";

export default async function EinstellungenRedirectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "partner") {
    redirect("/konto/partner/einstellungen");
  }

  redirect("/konto/reisender/einstellungen");
}
