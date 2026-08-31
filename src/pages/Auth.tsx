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
        name: validated.fullName || validated.email.split('@')[0] || 'Usuário',
      });

      if (result.error) {
        toast.error(result.error.message || 'Não foi possível criar a conta');
        console.error('Falha no cadastro', result.error);
        return;
      }

      const token = result?.data?.session?.access_token ?? result?.access_token ?? result?.data?.access_token;
      if (token) {
        try { setAccessToken(token); } catch {};
      }

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

      const result = await authClient.signIn.email({
        email: validated.email,
        password: validated.password,
      });

      if (result.error) {
        toast.error(result.error.message);
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
        <div className="hidden lg:block somma-dark-panel somma-grain rounded-[2rem] p-10 min-h-[520px] relative overflow-hidden">
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

        <Card className="w-full max-w-md mx-auto somma-panel rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Bem-vindo à Somma</CardTitle>
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
        </Card>
      </div>
    </div>
  );
};

export default Auth;
