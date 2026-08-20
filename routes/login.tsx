import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff, IconLanguage } from "@tabler/icons-react";
import { auth } from "@/lib/auth";
import { BASE_URL } from "@/lib/api/client";
import { BrandHero } from "@/components/common/Logo";

// Full-page redirect (not a fetch/XHR) — the backend's GET /auth/google
// starts the OAuth dance with Google itself and eventually redirects back to
// /auth/callback with a token in the URL fragment.
const GOOGLE_SIGNIN_URL = `${BASE_URL}/auth/google`;

export const Route = createFileRoute("/login")({ component: LoginPage });

const T = {
  en: {
    dir: "ltr" as const,
    title: "Welcome back",
    subtitle: "Sign in to your Khyate workspace",
    email: "Email Address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    submit: "Sign In",
    forgot: "Forgot password?",
    noAccount: "Don't have an account?",
    create: "Create one",
    switchLang: "العربية",
    errEmail: "Enter a valid email address",
    errPassword: "Password must be at least 8 characters",
    errInvalid: "Incorrect email or password",
    errRateLimited: "Too many sign-in attempts. Please wait a few minutes and try again.",
    errServer: "We couldn't reach the server. Please check your connection and try again.",
  },
  ar: {
    dir: "rtl" as const,
    title: "مرحباً بعودتك",
    subtitle: "سجّل الدخول إلى مساحة عمل خياطي",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "••••••••",
    submit: "تسجيل الدخول",
    forgot: "نسيت كلمة المرور؟",
    noAccount: "ليس لديك حساب؟",
    create: "أنشئ حساباً",
    switchLang: "English",
    errEmail: "أدخل بريدًا إلكترونيًا صحيحًا",
    errPassword: "كلمة المرور 8 أحرف على الأقل",
    errInvalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    errRateLimited: "محاولات تسجيل دخول كثيرة. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
    errServer: "تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مرة أخرى.",
  },
};

function LoginPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [notice, setNotice] = useState("");

  const t = T[lang];

  // The backend's Google OAuth callback redirects failures here with
  // ?error=oauth_failed (backend/src/routes/oauth.js) — this was previously
  // never read, so a failed Google sign-in landed back on a blank login form
  // with no indication anything had gone wrong.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth_failed") {
      setErr("Google sign-in failed. Please try again or sign in with your password.");
    }
  }, []);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setNotice("");
    if (!email.includes("@")) return setErr(t.errEmail);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => null);
      if (res?.ok) {
        setForgotSent(true);
        setNotice("If that email has an account, we've sent a 6-digit reset code.");
      } else setErr("Couldn't send the code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (code.length < 6) return setErr("Enter the 6-digit code.");
    // Matches the backend's MIN_PASSWORD_LEN, enforced on the reset endpoint too
    // (backend/src/routes/auth.js) — a shorter minimum here just produced a 400
    // the user couldn't interpret.
    if (newPass.length < 8) return setErr("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, new_password: newPass }),
      }).catch(() => null);
      if (res?.ok) {
        setForgot(false);
        setForgotSent(false);
        setCode("");
        setNewPass("");
        setPassword("");
        setNotice("Password updated — sign in with your new password.");
      } else {
        const b = res ? await res.json().catch(() => null) : null;
        setErr(b?.error || "That code is incorrect — try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Returns where a forced re-login should land: the page the admin was on
  // before their session expired, if one was carried through (client.ts's
  // 401 handler, _app.tsx's auth guard), else the usual role-based home.
  // Only accepts an in-app relative path — never an absolute/external URL —
  // and never re-targets /login itself, so a malformed or stale param can't
  // produce an open redirect or a bounce loop.
  const redirectTarget = (): string => {
    const raw = new URLSearchParams(window.location.search).get("redirect");
    if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")) {
      return raw;
    }
    return auth.homePath();
  };

  const finishLogin = (data: {
    token: string;
    user: { full_name: string; role: string; rank?: number };
  }) => {
    localStorage.setItem("khyate.token", data.token);
    localStorage.setItem("khyate.user", JSON.stringify(data.user));
    auth.completeApiLogin(email, data.user);
    navigate({ to: redirectTarget() });
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_token: pendingToken, code }),
      }).catch(() => null);
      if (res?.ok) finishLogin(await res.json());
      else setErr("That code is incorrect — try again.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!email.includes("@")) return setErr(t.errEmail);
    // Matches the backend's MIN_PASSWORD_LEN (backend/src/routes/auth.js) — a
    // shorter minimum here just produced a 400 the user couldn't interpret.
    if (password.length < 8) return setErr(t.errPassword);

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => null);

      if (res?.ok) {
        const data = await res.json();
        if (data.needs_totp) {
          setPendingToken(data.pre_token);
          setLoading(false);
          return;
        }
        finishLogin(data);
      } else if (res && (res.status === 401 || res.status === 400)) {
        setErr(t.errInvalid);
      } else if (res && res.status === 429) {
        // The backend locks an account out after repeated failures — say so,
        // rather than letting it fall through to a generic error.
        setErr(t.errRateLimited);
      } else {
        // Anything else (5xx, or a null res meaning the network call itself
        // failed) is a failure to authenticate — never a reason to grant
        // access. This branch previously called auth.completeDemoLogin(),
        // which set the authed flag and inferred the role from the email
        // string, defaulting to "admin". Because it caught every non-401/400
        // status, five deliberate failed logins (the backend answers 429) or
        // any transient 5xx handed the caller a rendered admin shell.
        setErr(t.errServer);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white" dir={t.dir}>
      {/* ── Left brand panel (lg+) ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-[0_0_52%] bg-gradient-to-br from-ivory via-ivory to-[#F2EEE4] relative overflow-hidden">
        {/* faint oversized K-mark watermark */}
        <img
          src="/khyate-logo.png"
          alt=""
          aria-hidden="true"
          className="absolute -right-20 -bottom-16 w-[34rem] opacity-[0.04] pointer-events-none select-none"
          draggable={false}
        />
        {/* soft colour orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-gold/5" />

        {/* centred lockup + gold rule */}
        <div className="relative z-10 flex flex-col items-center">
          <BrandHero tagline={false} />
          <div className="mt-7 h-px w-16 bg-gold/40" />
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-5">
          <button
            type="button"
            onClick={() => setLang((l) => (l === "en" ? "ar" : "en"))}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1"
          >
            <IconLanguage size={16} />
            {t.switchLang}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex lg:hidden justify-center mb-8">
              <BrandHero compact />
            </div>

            {forgot ? (
              <form onSubmit={forgotSent ? doReset : sendReset} className="space-y-5">
                <div className="mb-3 text-center lg:text-start">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Reset password
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {forgotSent
                      ? "Enter the code we emailed you and choose a new password."
                      : "Enter your account email and we'll send a reset code."}
                  </p>
                </div>
                <Input
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  disabled={forgotSent}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErr("");
                  }}
                  placeholder={t.emailPlaceholder}
                />
                {forgotSent && (
                  <>
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, ""));
                        setErr("");
                      }}
                      placeholder="123456"
                      className="text-center tracking-[0.4em] text-lg"
                    />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={newPass}
                      onChange={(e) => {
                        setNewPass(e.target.value);
                        setErr("");
                      }}
                      placeholder="New password"
                    />
                  </>
                )}
                {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button type="submit" disabled={loading} className="w-full font-medium h-11">
                  {loading ? "…" : forgotSent ? "Update password" : "Send reset code"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setForgot(false);
                    setForgotSent(false);
                    setCode("");
                    setNewPass("");
                    setErr("");
                    setNotice("");
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              </form>
            ) : pendingToken ? (
              <form onSubmit={verifyTotp} className="space-y-5">
                <div className="mb-3 text-center lg:text-start">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Two-factor verification
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setErr("");
                  }}
                  placeholder="123456"
                  className="text-center tracking-[0.4em] text-lg"
                />
                {err && <p className="text-sm text-destructive">{err}</p>}
                <Button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full font-medium h-11"
                >
                  {loading ? "…" : "Verify"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingToken(null);
                    setCode("");
                    setErr("");
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to sign in
                </button>
              </form>
            ) : (
              <>
                <div className="mb-7 text-center lg:text-start">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {t.title}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
                  {notice && <p className="mt-2 text-sm text-primary">{notice}</p>}
                </div>

                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErr("");
                      }}
                      placeholder={t.emailPlaceholder}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pw">{t.password}</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgot(true);
                          setErr("");
                          setNotice("");
                        }}
                        className="text-xs text-primary hover:text-primary-dark"
                      >
                        {t.forgot}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="pw"
                        type={show ? "text" : "password"}
                        dir="ltr"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErr("");
                        }}
                        placeholder={t.passwordPlaceholder}
                        className={t.dir === "rtl" ? "pl-10" : "pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${t.dir === "rtl" ? "left-3" : "right-3"}`}
                      >
                        {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                      </button>
                    </div>
                  </div>

                  {err && <p className="text-sm text-destructive">{err}</p>}

                  <Button type="submit" disabled={loading} className="w-full font-medium h-11">
                    {loading ? "…" : t.submit}
                  </Button>
                </form>

                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <a
                  href={GOOGLE_SIGNIN_URL}
                  className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-md border h-11 text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
                    />
                  </svg>
                  Sign in with Google
                </a>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {t.noAccount}{" "}
                  <Link to="/signup" className="text-primary hover:text-primary-dark font-medium">
                    {t.create}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
