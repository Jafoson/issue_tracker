import { redirect } from "next/navigation";

export default async function OldAppLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  redirect(`/${locale}/${workspace}`);
}
