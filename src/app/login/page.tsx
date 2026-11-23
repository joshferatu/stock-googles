import { Suspense } from "react";

import { LoginForm } from "@/components/login-form";
import { authConfig, safeNextPath } from "@/lib/session";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const config = authConfig();
  return (
    <Suspense>
      <LoginForm next={safeNextPath(rawNext)} sso={config.sso} />
    </Suspense>
  );
}
