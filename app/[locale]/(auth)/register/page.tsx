import { enabledOAuthProviders } from "@/auth.config";
import { RegisterForm } from "@/features/auth/components/RegisterForm/RegisterForm";

export default async function RegisterPage() {
  return <RegisterForm oauthProviders={enabledOAuthProviders} />;
}
