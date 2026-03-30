import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Lock, Mail, User, Shield, Cpu, Database, ChevronLeft, ChevronRight, Cookie, X } from "lucide-react";
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

const features = [
  { icon: Shield, title: "Quantum-Resistant", desc: "AES-256-CBC with double encryption layers" },
  { icon: Database, title: "Liquid Fragmentation", desc: "8-fragment distribution across storage nodes" },
  { icon: Cpu, title: "AI Authentication", desc: "Story-based narrative identity verification" },
  { icon: Lock, title: "Zero Knowledge Proofs", desc: "Noir-powered cryptographic commitments" },
];

function CookieCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4" data-testid="cookie-banner">
      <div className="max-w-2xl mx-auto bg-card/95 backdrop-blur-md border border-border rounded-md p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1">Cookie Notice</p>
            <p className="text-xs text-muted-foreground">
              We use cookies to enhance your experience. By continuing to use this site, you consent to our use of cookies.
            </p>
          </div>
          <button onClick={onDismiss} className="shrink-0 text-muted-foreground" data-testid="button-dismiss-cookies">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 ml-8">
          <Button size="sm" onClick={onDismiss} data-testid="button-accept-cookies">
            Accept All
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss} data-testid="button-reject-cookies">
            Reject All
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageSlideshow() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);

  return (
    <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden" data-testid="slideshow">
      {slides.map((slide, i) => (
        <img
          key={i}
          src={slide.src}
          alt={slide.alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
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
      <div className="lg:w-[45%] bg-[#0a0e27] text-white p-8 lg:p-12 flex flex-col justify-between min-h-[50vh] lg:min-h-screen relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Lock className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold tracking-tight">Liquid Encrypt</h1>
          </div>
          <p className="text-blue-300/80 text-sm ml-11">Quantum-Resistant Document Security</p>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center py-8 lg:py-12 space-y-8">
          <ImageSlideshow />

          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <f.icon className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="text-xs text-blue-200/60 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-blue-200/40 space-y-1">
          <p>256-bit AES encryption with quantum-resistant architecture</p>
          <p>SOC 2 Type II compliant infrastructure</p>
        </div>
      </div>

      <div
        className="lg:w-[55%] relative flex items-center justify-center p-6 lg:p-12 min-h-[50vh] lg:min-h-screen"
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${peekBg})` }}
        />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

        <div className="relative z-10 w-full max-w-md">
          <Card className="bg-card/90 backdrop-blur-md border-border/50 shadow-2xl">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-xl font-bold">
                  {authView === "login" ? "Sign In" : "Create Account"}
                </CardTitle>
                <span
                  className="text-xs font-medium text-emerald-500 cursor-default select-none"
                  data-testid="label-free-trial"
                >
                  Start a Free Trial
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {authView === "login"
                  ? "Access your encrypted documents"
                  : "Get started with quantum-resistant security"}
              </p>
            </CardHeader>
            <CardContent>
              {authView === "login" ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10"
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="password"
                                placeholder="••••••••"
                                className="pl-10"
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
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
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
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                placeholder="John Doe"
                                className="pl-10"
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
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10"
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                {...field}
                                type="password"
                                placeholder="••••••••"
                                className="pl-10"
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
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupMutation.isPending}
                      data-testid="button-signup"
                    >
                      {signupMutation.isPending ? "Creating account..." : "Sign Up"}
                    </Button>
                  </form>
                </Form>
              )}

              <div className="mt-4 text-center text-sm">
                {authView === "login" ? (
                  <>
                    <span className="text-muted-foreground">Don't have an account? </span>
                    <button
                      onClick={() => { setAuthView("signup"); setError(""); }}
                      className="text-primary hover-elevate"
                      data-testid="link-signup"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">Already have an account? </span>
                    <button
                      onClick={() => { setAuthView("login"); setError(""); }}
                      className="text-primary hover-elevate"
                      data-testid="link-login"
                    >
                      Log in
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showCookie && <CookieCard onDismiss={() => setShowCookie(false)} />}
    </div>
  );
}
