import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/actions/auth";

export default async function ProfilRedirectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.profile?.role === "partner") {
    redirect("/konto/partner/profil");
  }

  redirect("/konto/reisender/profil");
}
