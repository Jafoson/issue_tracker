import { enabledOAuthProviders } from "@/auth.config";
import { RegisterForm } from "@/features/auth/components/RegisterForm/RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <RegisterForm
      callbackUrl={callbackUrl}
      oauthProviders={enabledOAuthProviders}
    />
  );
}
