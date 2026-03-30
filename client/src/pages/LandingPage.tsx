import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { setToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, User, Shield, Cpu, Database, ChevronLeft, ChevronRight, Check, FileStack } from "lucide-react";
import beast01 from "@assets/beast-01-hash-wall.png";
import beast02 from "@assets/beast-02-code-vault.png";
import beast07 from "@assets/beast-07-lock-shield.png";
import peekBg from "@assets/peek.png";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

interface LandingPageProps {
  onSuccess: () => void;
}

const slides = [
  { src: beast01, alt: "Hash Wall Security" },
  { src: beast02, alt: "Code Vault Protection" },
  { src: beast07, alt: "Lock Shield Defense" },
];

const SLIDE_DURATIONS = [7200, 7200, 14400];

const features = [
  { icon: Shield, title: "Quantum-Resistant", desc: "AES-256-CBC with double encryption layers" },
  { icon: Database, title: "Liquid Fragmentation", desc: "8-fragment distribution across storage nodes" },
  { icon: Cpu, title: "AI Authentication", desc: "Story-based narrative identity verification" },
  { icon: Lock, title: "Zero Knowledge Proofs", desc: "Noir-powered cryptographic commitments" },
];

function CookieCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="absolute z-[10]"
      style={{
        top: "130px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "87%",
      }}
      data-testid="cookie-banner"
    >
      <div
        className="overflow-hidden rounded-xl"
        style={{
          background: "rgba(13, 20, 35, 0.97)",
          border: "1px solid rgba(99, 179, 237, 0.3)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ height: "4px", background: "#2B6CB0" }} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(99, 179, 237, 0.15)",
                border: "1px solid rgba(99, 179, 237, 0.25)",
              }}
            >
              <span className="text-sm">&#x1F36A;</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">We value your privacy</p>
              <p className="text-xs leading-relaxed mt-1" style={{ color: "#A0AEC0" }}>
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 mt-3.5">
            <button
              onClick={onDismiss}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium"
              style={{
                border: "1px solid rgba(99, 179, 237, 0.2)",
                background: "transparent",
                color: "#A0AEC0",
              }}
              data-testid="button-reject-cookies"
            >
              Reject All
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium text-white"
              style={{
                background: "#2B6CB0",
                border: "none",
              }}
              data-testid="button-accept-cookies"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageSlideshow() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const duration = SLIDE_DURATIONS[current] || 7200;
    const timer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [current]);

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: "16/10" }} data-testid="slideshow">
      {slides.map((slide, i) => (
        <img
          key={i}
          src={slide.src}
          alt={slide.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
          zIndex: 10,
        }}
      />
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3" style={{ zIndex: 11 }}>
        <button
          onClick={prev}
          className="bg-white/20 backdrop-blur-sm rounded-full p-1"
          aria-label="Previous slide"
          data-testid="button-slide-prev"
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === current ? "bg-white" : "bg-white/40"
              }`}
              data-testid={`button-slide-dot-${i}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="bg-white/20 backdrop-blur-sm rounded-full p-1"
          aria-label="Next slide"
          data-testid="button-slide-next"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}

export default function LandingPage({ onSuccess }: LandingPageProps) {
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [showCookie, setShowCookie] = useState(true);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      toast({ title: "Welcome back!", description: "Successfully logged in" });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      toast({ title: "Account created", description: "Welcome to Liquid Encrypt!" });
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message);
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    setError("");
    loginMutation.mutate(data);
  };

  const onSignupSubmit = (data: SignupForm) => {
    setError("");
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div
        className="hidden lg:flex lg:w-[45%] text-white flex-col overflow-y-auto"
        style={{ background: "#0f1b2d" }}
      >
        <div className="p-10 xl:p-12 flex flex-col justify-between min-h-screen">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">Liquid Encrypt</h1>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(191, 219, 254, 0.8)" }}>
              Quantum-Resistant Document Security
            </p>
          </div>

          <div className="py-8 space-y-8">
            <ImageSlideshow />

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} className="pt-6">
              <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "rgba(191, 219, 254, 0.5)" }}>
                Security Features
              </p>
              <div className="grid grid-cols-2 gap-4">
                {features.map((f) => (
                  <div key={f.title} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-xs font-medium text-white">{f.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(191, 219, 254, 0.7)" }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }} className="pt-6">
              <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(191, 219, 254, 0.5)" }}>
                Platform Highlights
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  "8-fragment encrypted distribution",
                  "AI-powered story authentication",
                  "Zero Knowledge Proof commitments",
                  "Grok document intelligence",
                  "Multi-tenant organization support",
                  "HMAC-SHA256 tamper-proof audit logs",
                  "5-tier role-based access control",
                  "Byte-precise storage quota enforcement",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span className="text-xs" style={{ color: "rgba(191, 219, 254, 0.7)" }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs space-y-1" style={{ color: "rgba(191, 219, 254, 0.4)" }}>
            <p>256-bit AES encryption with quantum-resistant architecture</p>
            <p>SOC 2 Type II compliant infrastructure</p>
          </div>
        </div>
      </div>

      <div
        className="flex-1 relative lg:sticky lg:top-0 lg:h-screen"
        style={{ backgroundColor: "#0a1628" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${peekBg})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0% center",
            zIndex: 1,
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: "rgba(10, 22, 40, 0.80)",
            zIndex: 2,
          }}
        />

        <div
          className="lg:hidden absolute top-6 left-6 flex items-center gap-2"
          style={{ zIndex: 3 }}
        >
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Liquid Encrypt</span>
        </div>

        <div
          className="absolute inset-0 overflow-y-auto flex items-center justify-center p-6"
          style={{ zIndex: 3, paddingTop: "8vh" }}
        >
          <div className="w-full max-w-[420px] relative">
            <div
              className="rounded-2xl p-8 pb-6 relative"
              style={{
                background: "rgba(13, 20, 35, 0.92)",
                border: "1px solid rgba(99, 179, 237, 0.2)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.08)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                minHeight: "550px",
              }}
            >
              <div className="mb-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      background: "rgba(99, 179, 237, 0.15)",
                      border: "1px solid rgba(99, 179, 237, 0.3)",
                    }}
                    data-testid="icon-logo"
                  >
                    <FileStack className="w-5 h-5" style={{ color: "#63B3ED" }} />
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-md select-none"
                    style={{
                      color: "#D69E2E",
                      background: "rgba(214, 158, 46, 0.15)",
                      border: "1px solid rgba(214, 158, 46, 0.4)",
                    }}
                    data-testid="badge-beta"
                  >
                    Beta 1.01
                  </span>
                </div>
                <h2 className="text-xl font-bold tracking-wide text-white uppercase" data-testid="text-brand-title">
                  Liquid Encryption
                </h2>
                <p className="text-[13px] mt-1" style={{ color: "#63B3ED" }} data-testid="text-brand-subtitle">
                  Quantum-Resistant
                </p>
              </div>

              {authView === "login" ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[0.8rem] font-medium" style={{ color: "#A0AEC0" }}>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#718096" }} />
                              <Input
                                {...field}
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 text-sm border"
                                style={{
                                  background: "rgba(255, 255, 255, 0.06)",
                                  borderColor: "rgba(99, 179, 237, 0.2)",
                                  color: "#E2E8F0",
                                }}
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[0.8rem] font-medium" style={{ color: "#A0AEC0" }}>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#718096" }} />
                              <Input
                                {...field}
                                type="password"
                                placeholder="••••••••"
                                className="pl-10 text-sm border"
                                style={{
                                  background: "rgba(255, 255, 255, 0.06)",
                                  borderColor: "rgba(99, 179, 237, 0.2)",
                                  color: "#E2E8F0",
                                }}
                                data-testid="input-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {error && (
                      <div className="text-sm text-destructive" data-testid="text-error">{error}</div>
                    )}
                    <button
                      type="submit"
                      disabled={loginMutation.isPending}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                      style={{ background: loginMutation.isPending ? "#2C5282" : "#2B6CB0" }}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </button>
                  </form>
                </Form>
              ) : (
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[0.8rem] font-medium" style={{ color: "#A0AEC0" }}>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#718096" }} />
                              <Input
                                {...field}
                                placeholder="John Doe"
                                className="pl-10 text-sm border"
                                style={{
                                  background: "rgba(255, 255, 255, 0.06)",
                                  borderColor: "rgba(99, 179, 237, 0.2)",
                                  color: "#E2E8F0",
                                }}
                                data-testid="input-name"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[0.8rem] font-medium" style={{ color: "#A0AEC0" }}>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#718096" }} />
                              <Input
                                {...field}
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 text-sm border"
                                style={{
                                  background: "rgba(255, 255, 255, 0.06)",
                                  borderColor: "rgba(99, 179, 237, 0.2)",
                                  color: "#E2E8F0",
                                }}
                                data-testid="input-email"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[0.8rem] font-medium" style={{ color: "#A0AEC0" }}>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#718096" }} />
                              <Input
                                {...field}
                                type="password"
                                placeholder="••••••••"
                                className="pl-10 text-sm border"
                                style={{
                                  background: "rgba(255, 255, 255, 0.06)",
                                  borderColor: "rgba(99, 179, 237, 0.2)",
                                  color: "#E2E8F0",
                                }}
                                data-testid="input-password"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {error && (
                      <div className="text-sm text-destructive" data-testid="text-error">{error}</div>
                    )}
                    <button
                      type="submit"
                      disabled={signupMutation.isPending}
                      className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                      style={{ background: signupMutation.isPending ? "#2C5282" : "#2B6CB0" }}
                      data-testid="button-signup"
                    >
                      {signupMutation.isPending ? "Creating account..." : "Sign Up"}
                    </button>
                  </form>
                </Form>
              )}

              <div
                className="mt-4 pt-4 text-center text-sm"
                style={{ borderTop: "1px solid rgba(99, 179, 237, 0.1)" }}
              >
                {authView === "login" ? (
                  <>
                    <span style={{ color: "#718096" }}>Don't have an account? </span>
                    <button
                      onClick={() => { setAuthView("signup"); setError(""); }}
                      className="font-medium"
                      style={{ color: "#63B3ED" }}
                      data-testid="link-signup"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: "#718096" }}>Already have an account? </span>
                    <button
                      onClick={() => { setAuthView("login"); setError(""); }}
                      className="font-medium"
                      style={{ color: "#63B3ED" }}
                      data-testid="link-login"
                    >
                      Log in
                    </button>
                  </>
                )}
              </div>

              <div className="mt-3 text-center">
                <span style={{ color: "#718096" }} className="text-sm">Or </span>
                <span
                  className="text-sm font-medium cursor-default select-none"
                  style={{ color: "#48BB78" }}
                  data-testid="label-free-trial"
                >
                  Start a Free Trial
                </span>
              </div>

              {showCookie && <CookieCard onDismiss={() => setShowCookie(false)} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
