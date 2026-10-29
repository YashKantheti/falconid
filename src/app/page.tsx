import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import "./landing.css";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace } = await searchParams;
  if (
    typeof workspace === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspace,
    )
  )
    redirect(`/identify?workspace=${workspace}`);
  return <LandingPage />;
}
