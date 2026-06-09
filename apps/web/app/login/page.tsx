"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to send code");
        return;
      }
      setStep("otp");
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.emailOtp({
        email,
        otp,
      });
      if (result.error) {
        setError(result.error.message ?? "Invalid code");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size={40} className="h-9 w-9" />
            <span className="text-xl font-semibold text-foreground">Afterclass</span>
          </div>

          <div className="w-full bg-card border border-border rounded-xl p-6 shadow-sm">
            {step === "email" ? (
              <>
                <div className="mb-5">
                  <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your email to receive a sign-in code.
                  </p>
                </div>

                <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      autoComplete="email"
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                      <svg
                        className="h-4 w-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending…" : "Send code"}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h1 className="text-lg font-semibold text-foreground">Check your email</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="otp">Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="123456"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                      autoComplete="one-time-code"
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading || otp.length < 6}>
                    {loading ? "Verifying…" : "Sign in"}
                  </Button>

                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground text-center transition-colors"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                    }}
                  >
                    Use a different email
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
