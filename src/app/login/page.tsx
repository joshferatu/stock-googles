import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in",
};

/**
 * Google SSO is the only gate. This route is kept so the OAuth client's
 * registered home page (`/login`) and older links keep working; middleware
 * normally redirects before this renders.
 */
export default function LoginPage() {
  redirect("/login/google");
}
