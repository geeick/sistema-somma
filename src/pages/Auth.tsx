import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authClient, getNeonAccessToken, getNeonUser } from "@/lib/auth";
import apiClient from "@/integrations/apiClient";
import { setAccessToken } from "@/integrations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const authSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100).optional(),
});

async function getPostAuthRedirect(tokenFromAuth?: string | null) {
  const token = tokenFromAuth || (await getNeonAccessToken());

  if (!token) {
    return "/dashboard";
  }

  try {
    const response = await fetch(`${API_BASE}/api/admin/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return "/dashboard";
    }

    const json = await response.json().catch(() => null);
    return json?.data?.isAdmin ? "/admin" : "/dashboard";
  } catch (error) {
    console.error("Post-auth admin check failed", error);
    return "/dashboard";
  }
}

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    let isMounted = true;

    getNeonUser()
      .then(async (user) => {
        if (!user || !isMounted) return;

        const redirectTo = await getPostAuthRedirect();
        if (isMounted) {
          navigate(redirectTo, { replace: true });
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = authSchema.parse({ email, password, fullName });
      setIsLoading(true);
      const result = await authClient.signUp.email({
        email: validated.email,
        password: validated.password,
        name: validated.fullName || validated.email.split('@')[0] || 'User',
      });

      if (result.error) {
        toast.error(result.error.message || 'Signup failed');
        console.error('Signup failed payload', result.error);
        return;
      }

      // If the auth result returned an access token, store it for the
      // server-side compatibility shim so requests include a Bearer token.
      const token = result?.data?.session?.access_token ?? result?.access_token ?? result?.data?.access_token;
      if (token) {
        try { setAccessToken(token); } catch {};
      }

      // Trigger a protected request to the server so the server's verifyToken
      // middleware creates the `profiles` row for this user.
      try {
        await apiClient.pages.list().catch(() => undefined);
      } catch (_) {}

      const redirectTo = await getPostAuthRedirect(token);
      toast.success('Account created successfully! Redirecting...');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = authSchema.parse({ email, password });
      setIsLoading(true);

      const result = await authClient.signIn.email({
        email: validated.email,
        password: validated.password,
      });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      // Store token if returned by adapter
      const token = result?.data?.session?.access_token ?? result?.access_token ?? result?.data?.access_token;
      if (token) {
        try { setAccessToken(token); } catch {}
      }

      // Trigger protected request to ensure server-side profile exists
      try { await apiClient.pages.list().catch(() => undefined); } catch {}

      const redirectTo = await getPostAuthRedirect(token);
      toast.success("Signed in successfully!");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to sign in");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-32 pb-16 flex items-center justify-center">
        <Card className="w-full max-w-md bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to CreatorPay</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to start earning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      maxLength={100}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      maxLength={100}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

