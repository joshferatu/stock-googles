import Link from "next/link";

import { PrivateAlphaBadge } from "@/components/private-alpha-badge";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Stock Googles handles Google account data, cookies, favourites and market-data requests.",
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="border-b border-border pb-6">
        <Link href="/login" className="text-sm font-semibold tracking-tight">
          Stock <span className="text-accent">Googles</span>
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted">Last updated: 22 November 2026</p>
        <PrivateAlphaBadge className="mt-3 justify-start" withCopy />
      </header>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">1. Who we are</h2>
          <p>
            Stock Googles (&quot;the app&quot;, &quot;we&quot;, &quot;us&quot;) is a private, non-commercial
            market dashboard operated by the individual who deployed it. It is currently in a Private Alpha:
            early access, with data and features that may change or become unavailable.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">2. Data we collect</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-fg">Google account identity.</strong> When you sign in with Google we
              receive your email address and display name. We request only the{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">openid</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">email</code> and{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">profile</code> scopes. We do not
              request or access Gmail, Drive, Calendar, Contacts, Photos, or any other Google data.
            </li>
            <li>
              <strong className="text-fg">Session data.</strong> A signed, HttpOnly cookie stores your verified
              email and the session expiry so you stay signed in for up to 30 days. Short-lived cookies carry
              the password gate and the Google OAuth state/PKCE handshake.
            </li>
            <li>
              <strong className="text-fg">Favourites and preferences.</strong> Your watchlist, theme, display
              currency, recent searches and cached market responses are stored in your browser&apos;s{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">localStorage</code>, not in a
              server database.
            </li>
            <li>
              <strong className="text-fg">Technical logs.</strong> Our hosting provider (Vercel) processes
              standard request logs such as IP address, user agent, timestamp and requested URL for security
              and reliability.
            </li>
            <li>
              <strong className="text-fg">Shared password.</strong> The password you enter is compared on the
              server against a deployment environment variable. The app does not store your password.
            </li>
          </ul>
          <p className="mt-3">
            We do not use advertising or analytics trackers, and we do not sell, rent or trade personal data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">3. Cookies and local storage</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2/60 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Lifetime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                <tr>
                  <td className="px-3 py-2 font-mono text-[11px] text-fg">sg_session</td>
                  <td className="px-3 py-2">Keeps you signed in; contains your verified email.</td>
                  <td className="px-3 py-2">30 days</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-[11px] text-fg">sg_gate</td>
                  <td className="px-3 py-2">Proves the shared-password step while you complete Google sign-in.</td>
                  <td className="px-3 py-2">15 minutes</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-[11px] text-fg">sg_oauth</td>
                  <td className="px-3 py-2">Protects the Google OAuth state and PKCE handshake.</td>
                  <td className="px-3 py-2">10 minutes</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-[11px] text-fg">localStorage</td>
                  <td className="px-3 py-2">Favourites, theme, currency, recent searches, cached market data.</td>
                  <td className="px-3 py-2">Until you clear it</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            These cookies are required for authentication and are not used for advertising. You can remove them
            through your browser settings; this signs you out and deletes locally stored favourites.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">4. How we use data</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Authenticate you and enforce the shared-password + Google sign-in gates.</li>
            <li>Show the signed-in email in Settings.</li>
            <li>Remember your favourites and display preferences in your browser.</li>
            <li>Operate, secure, debug and improve the service.</li>
          </ul>
          <p className="mt-3">
            Where data-protection law applies, we rely on your consent for Google sign-in, our legitimate
            interests in operating and securing the app, and your choices about local storage. You can withdraw
            consent by signing out and not using Google sign-in again.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">5. Sharing and processors</h2>
          <p>We share data only with service providers needed to run the app:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-fg">Vercel</strong> — hosting, edge middleware and standard request logs.
            </li>
            <li>
              <strong className="text-fg">Google</strong> — OAuth sign-in and the basic profile/email returned
              by Google.
            </li>
            <li>
              <strong className="text-fg">Market-data providers</strong> — Yahoo Finance, CNBC, StockAnalysis,
              TradingView, Nasdaq, Google News RSS, open.er-api.com and, when needed, the{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">r.jina.ai</code> reader proxy used
              to reach Yahoo. These requests contain market symbols (for example{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">AAPL</code>) and are made from our
              servers; your Google identity and session cookies are not sent to them.
            </li>
          </ul>
          <p className="mt-3">
            We may also disclose data if required by law or to protect the security of the service. We do not
            sell personal data.
          </p>
          <p className="mt-3 rounded-lg border border-border bg-surface/60 p-3 text-xs">
            Stock Googles&apos; use and transfer to any other app of information received from Google APIs will
            adhere to the{" "}
            <a
              className="text-accent hover:underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">6. Retention</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Session cookie: up to 30 days; password gate: 15 minutes; OAuth state: 10 minutes.</li>
            <li>Favourites, preferences and cached market data: until you clear your browser storage.</li>
            <li>Hosting logs: according to Vercel&apos;s retention settings.</li>
            <li>The app does not operate a database and does not store Google access or refresh tokens.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">7. Security</h2>
          <p>
            The app is served over HTTPS. Session and OAuth cookies are HttpOnly, SameSite=Lax and Secure in
            production, and tokens are signed with HMAC-SHA256. No method of transmission or storage is
            completely secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">8. Your choices and rights</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sign out at any time from Settings; this clears the local session.</li>
            <li>Clear cookies and site data in your browser to remove locally stored favourites and preferences.</li>
            <li>
              Depending on your jurisdiction (for example the EEA, UK or California), you may have rights to
              access, correct, delete or restrict processing of personal data, or to object to processing.
            </li>
            <li>We do not sell or share personal information for cross-context behavioural advertising.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">9. Children</h2>
          <p>
            The app is not directed to children under 16, and we do not knowingly collect personal data from
            them. If you believe a child has provided data, contact us so it can be removed.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">10. Changes to this policy</h2>
          <p>
            We may update this policy as the Private Alpha evolves. The &quot;Last updated&quot; date above will
            change, and material changes will be noted on this page.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">11. Contact</h2>
          <p>
            For privacy questions or requests, contact{" "}
            {CONTACT_EMAIL ? (
              <a className="text-accent hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            ) : (
              <span>the support email listed on the app&apos;s Google OAuth consent screen</span>
            )}
            .
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface/60 p-4">
          <h2 className="mb-1 text-sm font-semibold text-fg">Not investment advice</h2>
          <p className="text-xs">
            Market data is provided for information only, may be delayed and is not investment advice. The app
            is a Private Alpha and may be unavailable or change without notice.
          </p>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-[11px] text-muted">
        <Link href="/login" className="hover:text-fg">
          Back to sign in
        </Link>
        <span aria-hidden>·</span>
        <Link href="/" className="hover:text-fg">
          Dashboard
        </Link>
      </footer>
    </div>
  );
}
