import { redirect } from "next/navigation";

import { GoogleLoginForm } from "@/components/google-login-form";
import { googleErrorMessage } from "@/lib/google";
import { authConfig, safeNextPath } from "@/lib/session";

export const metadata = {
  title: "Continue with Google",
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function GoogleLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const config = authConfig();
  if (!config.sso) redirect("/login");

  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  const error = googleErrorMessage(first(params.error));

  return (
    <GoogleLoginForm
      next={next}
      mock={config.google.mock}
      initialError={error}
      allowedDomain={config.google.allowedDomain}
    />
  );
}
