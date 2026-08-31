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
import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw } from "lucide-react";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const authSchema = z.object({
  email: z.string().email("Digite um e-mail válido").max(255),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(100),
  fullName: z.string().min(2, "O nome precisa ter pelo menos 2 caracteres").max(100).optional(),
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
    console.error("Falha ao verificar perfil administrativo", error);
    return "/dashboard";
  }
}

function getAuthErrorDetails(result: any) {
  const error = result?.error || result?.data?.error || null;
  const status = Number(error?.status || error?.statusCode || error?.code === "EMAIL_NOT_VERIFIED" ? 403 : 0);
  const code = String(error?.code || error?.body?.code || "").toUpperCase();
  const message = String(error?.message || error?.body?.message || "");

  return { error, status, code, message };
}

function isEmailVerificationError(result: any) {
  const { status, code, message } = getAuthErrorDetails(result);
  return (
    status === 403 ||
    code.includes("EMAIL_NOT_VERIFIED") ||
    code.includes("EMAIL_VERIFICATION") ||
    /verify.*email|email.*verify|e-mail.*verific/i.test(message)
  );
}

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "1") {
      toast.success("E-mail verificado com sucesso. Agora você já pode entrar.");
      window.history.replaceState({}, "", "/auth");
    }

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

  const showVerificationScreen = (targetEmail: string, sent = true) => {
    setVerificationEmail(targetEmail);
    setVerificationSent(sent);
    setPassword("");
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;

    setIsResending(true);
    try {
      const callbackURL = `${window.location.origin}/auth?verified=1`;
      const result: any = await (authClient as any).sendVerificationEmail({
        email: verificationEmail,
        callbackURL,
      });

      if (result?.error) {
        throw new Error(result.error.message || "Não foi possível reenviar o e-mail de verificação.");
      }

      setVerificationSent(true);
      toast.success("E-mail de verificação reenviado.");
    } catch (error: any) {
      console.error("Falha ao reenviar e-mail de verificação", error);
      toast.error(error?.message || "Não foi possível reenviar o e-mail de verificação.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = authSchema.parse({ email, password, fullName });
      setIsLoading(true);
      const result: any = await authClient.signUp.email({
        email: validated.email,
        password: validated.password,
        name: validated.fullName || validated.email.split('@')[0] || 'Usuário',
      });

      if (result?.error) {
        if (isEmailVerificationError(result)) {
          showVerificationScreen(validated.email, true);
          return;
        }
        toast.error(result.error.message || 'Não foi possível criar a conta');
        console.error('Falha no cadastro', result.error);
        return;
      }

      const token = result?.data?.session?.access_token ?? result?.access_token ?? result?.data?.access_token;

      // When email verification is required, Better Auth creates the account
      // without issuing a session token. In that case we intentionally stop here
      // and ask the user to verify their email before entering Somma.
      if (!token) {
        showVerificationScreen(validated.email, true);
        toast.success("Conta criada. Verifique seu e-mail para continuar.");
        return;
      }

      try { setAccessToken(token); } catch {}

      try {
        await apiClient.pages.list().catch(() => undefined);
      } catch (_) {}

      const redirectTo = await getPostAuthRedirect(token);
      toast.success('Conta criada com sucesso. Redirecionando...');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Não foi possível criar a conta");
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

      const result: any = await authClient.signIn.email({
        email: validated.email,
        password: validated.password,
      });

      if (result?.error) {
        if (isEmailVerificationError(result)) {
          showVerificationScreen(validated.email, true);
          toast.message("Confirme seu e-mail antes de entrar.");
          return;
        }
        toast.error(result.error.message || "Não foi possível entrar");
        return;
      }

      const token = result?.data?.session?.access_token ?? result?.access_token ?? result?.data?.access_token;
      if (token) {
        try { setAccessToken(token); } catch {}
      }

      try { await apiClient.pages.list().catch(() => undefined); } catch {}

      const redirectTo = await getPostAuthRedirect(token);
      toast.success("Entrada realizada com sucesso.");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Não foi possível entrar");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-32 pb-16 grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-center">
        <div className="hidden lg:block somma-dark-panel somma-grain rounded-[2rem] p-10 min-h-[520px] relative overflow-hidden page-enter">
          <div className="relative z-10 max-w-md">
            <p className="text-primary font-semibold mb-4">Área de acesso Somma</p>
            <h1 className="font-display text-6xl font-black leading-[0.9] text-[#f7ead1] mb-6">
              Entre no movimento.
            </h1>
            <p className="text-[#f7ead1]/78 text-lg">
              Conecte páginas, participe de campanhas e acompanhe seus ganhos em um painel inspirado na cultura musical.
            </p>
          </div>
          <div className="absolute -right-28 bottom-[-120px] h-96 w-96 rounded-full record-art" />
        </div>

        <Card className="w-full max-w-md mx-auto somma-panel rounded-[1.75rem] page-enter stagger-1">
          {verificationEmail ? (
            <>
              <CardHeader className="text-center items-center pt-9">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--somma-pink))]/10 text-[hsl(var(--somma-pink))]">
                  <MailCheck className="h-8 w-8" />
                </div>
                <CardTitle className="text-3xl font-extrabold">Verifique seu e-mail</CardTitle>
                <CardDescription className="text-[0.96rem] leading-relaxed max-w-sm">
                  Enviamos um link de confirmação para <span className="font-bold text-foreground">{verificationEmail}</span>. Abra o e-mail e clique no link para ativar sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <div className="rounded-2xl border border-border bg-background/70 p-4 flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Depois da confirmação</p>
                    <p className="ui-caption mt-1">Você será redirecionado de volta para a Somma e poderá entrar normalmente.</p>
                  </div>
                </div>

                <Button onClick={handleResendVerification} variant="outline" className="w-full rounded-xl font-bold" disabled={isResending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Reenviando..." : "Reenviar e-mail"}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setVerificationEmail(null);
                    setVerificationSent(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Button>

                {verificationSent && (
                  <p className="text-center ui-caption">Não encontrou? Confira também Spam, Promoções e Lixo eletrônico.</p>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-3xl font-extrabold">Bem-vindo à Somma</CardTitle>
                <CardDescription>
                  Entre na sua conta ou crie uma nova para começar a participar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted">
                    <TabsTrigger value="signin" className="rounded-full">Entrar</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-full">Criar conta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">E-mail</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="voce@exemplo.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          maxLength={255}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Senha</Label>
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
                      <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
                        {isLoading ? "Entrando..." : "Entrar"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Nome completo</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Seu nome"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">E-mail</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="voce@exemplo.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          maxLength={255}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Senha</Label>
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
                      <Button type="submit" className="w-full rounded-full" disabled={isLoading}>
                        {isLoading ? "Criando conta..." : "Criar conta"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;
