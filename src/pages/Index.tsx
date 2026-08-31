import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle, Music2, PlayCircle, TrendingUp, Users, Wallet } from "lucide-react";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const Index = () => {
  const [user, setUser] = useState<NeonUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNeonUser().then((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    }).catch(() => {
      setUser(null);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: Music2,
      title: "Transforme música em movimento",
      description: "Campanhas criadas para músicas brasileiras chegarem em novas comunidades.",
    },
    {
      icon: Users,
      title: "Criadores entram na cultura",
      description: "TikTok, Instagram e Shorts reunidos em uma experiência simples para criadores.",
    },
    {
      icon: Wallet,
      title: "Ganhe pelo impacto",
      description: "Acompanhe envios, aprovações, métricas e pagamentos em um só painel.",
    },
  ];

  return (
    <div className="min-h-screen somma-shell text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <section id="descobrir" className="container mx-auto px-4">
          <div className="somma-dark-panel somma-grain rounded-[2rem] overflow-hidden min-h-[620px] grid lg:grid-cols-[1.08fr_0.92fr] items-stretch">
            <div className="relative z-10 p-8 md:p-14 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary w-fit mb-8">
                <PlayCircle className="h-4 w-4" />
                Somma para campanhas de música e criadores
              </div>

              <h1 className="font-display text-6xl md:text-7xl xl:text-8xl leading-[0.86] font-black text-[#f7ead1] drop-shadow mb-8">
                Transforme
                <br />
                músicas em
                <br />
                movimentos
                <br />
                culturais
              </h1>

              <p className="max-w-xl text-lg md:text-xl text-[#f7ead1]/82 mb-8">
                A Somma conecta artistas, marcas e criadores para lançar campanhas, medir impacto e pagar criadores com clareza.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="rounded-full bg-primary text-primary-foreground hover:bg-accent shadow-glow">
                  <Link to="/auth">Começar um movimento</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="rounded-full border-primary/50 bg-transparent text-[#f7ead1] hover:bg-primary hover:text-primary-foreground">
                  <Link to="/auth">Explorar campanhas →</Link>
                </Button>
              </div>
            </div>

            <div className="relative min-h-[420px] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-2/5 retro-stripes opacity-95 rounded-r-[60%]" />
              <div className="absolute right-[-120px] top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full record-art" />
              <div className="absolute right-20 top-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground h-28 w-28 flex items-center justify-center font-display text-2xl font-black shadow-glow">
                somma
              </div>
            </div>
          </div>

          <div className="somma-panel rounded-b-[2rem] border-t-0 px-6 py-5 flex flex-wrap items-center justify-center gap-8 text-sm uppercase tracking-[0.18em] text-muted-foreground">
            <span className="font-semibold text-foreground">Destaque em</span>
            <span>Rolling Stone</span>
            <span>FADER</span>
            <span>Okayplayer</span>
            <span>Billboard</span>
          </div>
        </section>

        <section id="como-funciona" className="container mx-auto px-4 py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="font-display text-5xl font-black mb-4">Como funciona</h2>
            <p className="text-lg text-muted-foreground">
              Um fluxo direto para lançar campanhas, receber envios e acompanhar resultados sem planilhas soltas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={feature.title} className="somma-panel rounded-[1.5rem]">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="font-display text-2xl">
                    {String(index + 1).padStart(2, "0")} · {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="criadores" className="container mx-auto px-4 pb-20">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-stretch">
            <Card className="somma-dark-panel somma-grain rounded-[2rem] p-2">
              <CardHeader>
                <CardTitle className="font-display text-4xl text-[#f7ead1]">Painel do criador</CardTitle>
                <CardDescription className="text-[#f7ead1]/75">
                  Tudo que um criador precisa para participar de campanhas e sacar pagamentos.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  ["Total de streams", "2,48M", "+18,4% nos últimos 30 dias"],
                  ["Apoiadores", "18,7K", "+12,4% nos últimos 30 dias"],
                  ["Ganhos", "R$ 12.630", "+22,1% este mês"],
                  ["Carteira", "R$ 4.560,35", "Disponível para saque"],
                ].map(([label, value, note]) => (
                  <div key={label} className="rounded-2xl bg-[#f7ead1] p-5 text-foreground shadow-lg">
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <p className="font-display text-3xl font-black">{value}</p>
                    <p className="text-xs text-green-700 mt-2">{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="somma-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle className="font-display text-4xl">Da campanha ao pagamento</CardTitle>
                <CardDescription className="text-base">
                  Somma organiza movimentos musicais com páginas conectadas, envios verificados e carteira integrada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Criadores conectam TikTok e páginas sociais autorizadas.",
                  "Campanhas definem música, regras, plataformas e tags obrigatórias.",
                  "A equipe aprova envios, sincroniza métricas e libera pagamento.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-background/70 p-4">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                    <p>{item}</p>
                  </div>
                ))}

                <div className="pt-2">
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/auth">Criar conta gratuita</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="sobre" className="container mx-auto px-4">
          <Card className="somma-panel rounded-[2rem] text-center">
            <CardHeader className="space-y-4 pt-12">
              <TrendingUp className="h-10 w-10 text-primary mx-auto" />
              <CardTitle className="font-display text-5xl font-black">
                Pronto para lançar o próximo movimento?
              </CardTitle>
              <CardDescription className="text-lg max-w-2xl mx-auto">
                Use a Somma para reunir criadores, acompanhar resultados e transformar música em cultura.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-12">
              <Button size="lg" asChild className="rounded-full shadow-glow">
                <Link to="/auth">Entrar na Somma</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-muted-foreground">
        <p>&copy; 2026 Somma. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Index;
