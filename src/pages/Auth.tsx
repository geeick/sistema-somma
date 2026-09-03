import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { SiteFooter } from "@/components/SiteFooter";
import { ArrowLeft, CheckCircle2, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
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
  const status = Number(error?.status || error?.statusCode || (error?.code === "EMAIL_NOT_VERIFIED" ? 403 : 0));
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);

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

  const showVerificationScreen = (targetEmail: string, sent = true) => {
    setVerificationEmail(targetEmail);
    setVerificationCode("");
    setVerificationSent(sent);
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationEmail) return;

    const otp = verificationCode.replace(/\D/g, "").slice(0, 6);
    if (otp.length !== 6) {
      toast.error("Digite o código de 6 dígitos enviado por e-mail.");
      return;
    }

    setIsVerifying(true);
    try {
      const emailOtp = (authClient as any).emailOtp;
      if (!emailOtp?.verifyEmail) {
        throw new Error("A verificação por código não está disponível neste cliente de autenticação.");
      }

      const result: any = await emailOtp.verifyEmail({
        email: verificationEmail,
        otp,
      });

      if (result?.error) {
        throw new Error(result.error.message || "Código inválido ou expirado.");
      }

      toast.success("E-mail verificado com sucesso.");

      // If the password is still available from this signup/sign-in attempt,
      // sign the user in immediately after successful verification.
      if (password) {
        const signInResult: any = await authClient.signIn.email({
          email: verificationEmail,
          password,
        });

        if (!signInResult?.error) {
          const token = signInResult?.data?.session?.access_token ?? signInResult?.access_token ?? signInResult?.data?.access_token;
          if (token) {
            try { setAccessToken(token); } catch {}
          }
          const redirectTo = await getPostAuthRedirect(token);
          navigate(redirectTo, { replace: true });
          return;
        }
      }

      setEmail(verificationEmail);
      setVerificationEmail(null);
      setVerificationCode("");
      setPassword("");
      toast.message("Agora você já pode entrar na sua conta.");
    } catch (error: any) {
      console.error("Falha ao verificar e-mail", error);
      toast.error(error?.message || "Código inválido ou expirado. Tente novamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;

    setIsResending(true);
    try {
      const emailOtp = (authClient as any).emailOtp;
      if (!emailOtp?.sendVerificationOtp) {
        throw new Error("O reenvio por código não está disponível neste cliente de autenticação.");
      }

      const result: any = await emailOtp.sendVerificationOtp({
        email: verificationEmail,
        type: "email-verification",
      });

      if (result?.error) {
        throw new Error(result.error.message || "Não foi possível reenviar o código.");
      }

      setVerificationCode("");
      setVerificationSent(true);
      toast.success("Novo código enviado. Ele expira em 10 minutos.");
    } catch (error: any) {
      console.error("Falha ao reenviar código de verificação", error);
      toast.error(error?.message || "Não foi possível reenviar o código de verificação.");
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

      if (!token) {
        showVerificationScreen(validated.email, true);
        toast.success("Conta criada. Digite o código enviado ao seu e-mail.");
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
          toast.message("Digite o código enviado ao seu e-mail para confirmar sua conta.");
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
            <p className="pink-kicker mb-4">Área de acesso Somma</p>
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
                <CardTitle className="text-3xl font-extrabold">Confirme seu e-mail</CardTitle>
                <CardDescription className="text-[0.96rem] leading-relaxed max-w-sm">
                  Enviamos um código de 6 dígitos para <span className="font-bold text-foreground">{verificationEmail}</span>. Digite o código abaixo para ativar sua conta.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Código de verificação</Label>
                    <Input
                      id="verification-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-14 text-center text-2xl font-extrabold tracking-[0.34em] tabular-nums"
                      autoFocus
                    />
                    <p className="ui-caption text-center">O código expira em 10 minutos.</p>
                  </div>

                  <Button type="submit" className="w-full rounded-xl font-bold" disabled={isVerifying || verificationCode.length !== 6}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {isVerifying ? "Verificando..." : "Confirmar e-mail"}
                  </Button>
                </form>

                <div className="rounded-2xl border border-border bg-background/70 p-4 flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Não recebeu?</p>
                    <p className="ui-caption mt-1">Confira Spam, Promoções e Lixo eletrônico ou solicite um novo código.</p>
                  </div>
                </div>

                <Button onClick={handleResendVerification} variant="outline" className="w-full rounded-xl font-bold" disabled={isResending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Reenviando..." : "Reenviar código"}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full rounded-xl"
                  onClick={() => {
                    setVerificationEmail(null);
                    setVerificationCode("");
                    setVerificationSent(false);
                  }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </Button>

                {verificationSent && (
                  <p className="text-center ui-caption">Use apenas o código mais recente recebido por e-mail.</p>
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
                <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
                  Ao criar uma conta, você concorda com os <Link to="/terms" className="font-bold text-[hsl(var(--somma-pink-deep))] hover:underline">Termos de Serviço</Link> e reconhece a nossa <Link to="/privacy" className="font-bold text-[hsl(var(--somma-pink-deep))] hover:underline">Política de Privacidade</Link>.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
};

export default Auth;
