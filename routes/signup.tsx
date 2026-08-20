import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  IconEye,
  IconEyeOff,
  IconLanguage,
  IconScissors,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { auth } from "@/lib/auth";
import { BASE_URL } from "@/lib/api/client";
import { BrandHero } from "@/components/common/Logo";

export const Route = createFileRoute("/signup")({ component: SignupPage });

const T = {
  en: {
    dir: "ltr" as const,
    badge: "For tailors",
    title: "Create your tailor account",
    subtitle: "Join Khyate as a tailor — set up your storefront and start taking orders.",
    name: "Full name",
    namePlaceholder: "Your name",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    submit: "Create tailor account",
    haveAccount: "Already have an account?",
    signin: "Sign in",
    switchLang: "العربية",
    customerNote: "Looking to shop?",
    getApp: "Customers order on the Khyate app",
    panelLine:
      "Your storefront, appointments, measurements and payouts — in one elegant workspace.",
    errName: "Please enter your name",
    errEmail: "Enter a valid email address",
    errPassword: "Password must be at least 8 characters",
    errExists: "This email is already registered",
    errGeneric: "Could not create account. Please try again.",
  },
  ar: {
    dir: "rtl" as const,
    badge: "للخياطين",
    title: "أنشئ حساب خياطتك",
    subtitle: "انضم إلى خياطي كخياط — جهّز متجرك وابدأ باستقبال الطلبات.",
    name: "الاسم الكامل",
    namePlaceholder: "اسمك",
    email: "البريد الإلكتروني",
    emailPlaceholder: "you@example.com",
    password: "كلمة المرور",
    passwordPlaceholder: "8 أحرف على الأقل",
    submit: "إنشاء حساب خياط",
    haveAccount: "لديك حساب بالفعل؟",
    signin: "تسجيل الدخول",
    switchLang: "English",
    customerNote: "هل تريد التسوّق؟",
    getApp: "العملاء يطلبون عبر تطبيق خياطي",
    panelLine: "متجرك ومواعيدك وقياساتك ومدفوعاتك — في مساحة عمل أنيقة واحدة.",
    errName: "الرجاء إدخال اسمك",
    errEmail: "أدخل بريدًا إلكترونيًا صحيحًا",
    errPassword: "كلمة المرور 8 أحرف على الأقل",
    errExists: "هذا البريد الإلكتروني مسجّل بالفعل",
    errGeneric: "تعذّر إنشاء الحساب. حاول مرة أخرى.",
  },
};

function SignupPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const t = T[lang];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!fullName.trim()) return setErr(t.errName);
    if (!email.includes("@")) return setErr(t.errEmail);
    // Matches the backend's MIN_PASSWORD_LEN (backend/src/routes/auth.js) — a
    // shorter minimum here just produced a 400 the user couldn't interpret.
    if (password.length < 8) return setErr(t.errPassword);

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Web sign-up is for tailors only — customers register in the mobile app.
        body: JSON.stringify({ email, password, full_name: fullName, role: "tailor" }),
      }).catch(() => null);

      if (res?.ok) {
        const data = await res.json();
        localStorage.setItem("khyate.token", data.token);
        localStorage.setItem("khyate.user", JSON.stringify(data.user));
        auth.completeApiLogin(email, data.user);
        navigate({ to: auth.homePath() });
      } else if (res?.status === 409) {
        setErr(t.errExists);
      } else {
        setErr(t.errGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white" dir={t.dir}>
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-[0_0_52%] bg-gradient-to-br from-ivory via-ivory to-[#F2EEE4] relative overflow-hidden">
        <img
          src="/khyate-logo.png"
          alt=""
          aria-hidden="true"
          className="absolute -right-20 -bottom-16 w-[34rem] opacity-[0.04] pointer-events-none select-none"
          draggable={false}
        />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-gold/5" />
        <div className="relative z-10 flex flex-col items-center text-center px-10">
          <BrandHero tagline={false} />
          <div className="mt-7 h-px w-16 bg-gold/40" />
          <p className="mt-6 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {t.panelLine}
          </p>
        </div>
      </div>

      {/* Right form panel */}
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
            <div className="flex lg:hidden justify-center mb-8">
              <BrandHero compact />
            </div>

            <div className="mb-7 text-center lg:text-start">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary-dark">
                <IconScissors size={13} /> {t.badge}
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {t.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name">{t.name}</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setErr("");
                  }}
                  placeholder={t.namePlaceholder}
                />
              </div>

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
                <Label htmlFor="pw">{t.password}</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={show ? "text" : "password"}
                    dir="ltr"
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

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t.haveAccount}{" "}
              <Link to="/login" className="text-primary hover:text-primary-dark font-medium">
                {t.signin}
              </Link>
            </p>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                <IconDeviceMobile size={16} className="text-primary" /> {t.customerNote}
              </div>
              <a href="/get-app" className="mt-1 inline-block text-sm text-primary hover:underline">
                {t.getApp}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
