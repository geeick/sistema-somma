import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle, Music2, PlayCircle, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const participatingArtists = [
  "Alok",
  "Anitta",
  "Bruno Mars",
  "Pedro Sampaio",
  "Kehlani",
  "Gil",
  "João Gomes",
  "MC Don Juan",
  "MC Hariel",
  "Léo Foguete",
  "Lil Tecca",
  "Addison Rae",
  "O Rappa",
  "Charli XCX",
  "Shakira",
  "Dua Lipa",
];

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

  const carouselArtists = [...participatingArtists, ...participatingArtists];

  return (
    <div className="min-h-screen somma-shell text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <section id="descobrir" className="container mx-auto px-4">
          <div className="somma-dark-panel somma-grain rounded-[2rem] overflow-hidden min-h-[600px] grid lg:grid-cols-[1.08fr_0.92fr] items-stretch">
            <div className="relative z-10 p-7 md:p-12 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--somma-pink))]/50 bg-[hsl(var(--somma-pink))]/12 px-4 py-2 text-xs font-bold text-[hsl(var(--somma-pink))] w-fit mb-7 uppercase tracking-[0.14em]">
                <Sparkles className="h-4 w-4" />
                Somma para campanhas de música e criadores
              </div>

              <h1 className="font-display text-5xl md:text-6xl xl:text-7xl leading-[0.88] font-black text-[#f7ead1] drop-shadow mb-7">
                Transforme
                <br />
                músicas em
                <br />
                movimentos
                <br />
                culturais
              </h1>

              <p className="max-w-xl text-base md:text-lg text-[#f7ead1]/82 mb-8 leading-relaxed">
                A Somma conecta artistas, marcas e criadores para lançar campanhas, medir impacto e pagar criadores com clareza.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild className="rounded-full bg-primary text-primary-foreground hover:bg-[hsl(var(--somma-pink))] hover:text-white shadow-glow">
                  <Link to="/auth">Começar um movimento</Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="rounded-full border-[hsl(var(--somma-pink))]/60 bg-transparent text-[#f7ead1] hover:bg-[hsl(var(--somma-pink))] hover:text-white">
                  <Link to="/auth">Explorar campanhas →</Link>
                </Button>
              </div>
            </div>

            <div className="relative min-h-[400px] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-2/5 retro-stripes opacity-95 rounded-r-[60%]" />
              <div className="absolute right-[-120px] top-1/2 h-[540px] w-[540px] -translate-y-1/2 rounded-full record-art" />
              <div className="absolute right-20 top-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--somma-pink))] text-white h-28 w-28 flex items-center justify-center font-display text-2xl font-black shadow-pink-glow">
                somma
              </div>
            </div>
          </div>

          <div className="somma-panel rounded-b-[2rem] border-t-0 px-5 py-5 overflow-hidden">
            <div className="flex items-center gap-4 mb-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--somma-pink))] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-pink-glow">
                <Sparkles className="h-3.5 w-3.5" />
                Artistas participantes
              </span>
              <span className="hidden md:inline text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Um carrossel vivo de nomes que combinam cultura pop, funk, brasilidades e música global
              </span>
            </div>

            <div className="artist-carousel" aria-label="Carrossel de artistas participantes">
              <div className="artist-carousel-track">
                {carouselArtists.map((artist, index) => (
                  <span key={`${artist}-${index}`} className="artist-pill">
                    {artist}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="container mx-auto px-4 py-16">
          <div className="text-center max-w-3xl mx-auto mb-10 reveal-on-scroll">
            <h2 className="font-display text-4xl md:text-5xl font-black mb-4">Como funciona</h2>
            <p className="text-base md:text-lg text-muted-foreground">
              Um fluxo direto para lançar campanhas, receber envios e acompanhar resultados sem planilhas soltas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <Card key={feature.title} className="somma-panel somma-card-hover rounded-[1.5rem] reveal-on-scroll">
                <CardHeader>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="font-display text-xl md:text-2xl">
                    {String(index + 1).padStart(2, "0")} · {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm md:text-base text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="criadores" className="container mx-auto px-4 pb-16">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-7 items-stretch">
            <Card className="somma-dark-panel somma-grain rounded-[2rem] p-2 reveal-on-scroll">
              <CardHeader>
                <CardTitle className="font-display text-3xl md:text-4xl text-[#f7ead1]">Painel do criador</CardTitle>
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
                  <div key={label} className="rounded-2xl bg-[#f7ead1] p-4 text-foreground shadow-lg border border-[hsl(var(--somma-pink))]/15">
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <p className="font-display text-2xl md:text-3xl font-black">{value}</p>
                    <p className="text-xs text-green-700 mt-2">{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="somma-panel somma-card-hover rounded-[2rem] reveal-on-scroll">
              <CardHeader>
                <CardTitle className="font-display text-3xl md:text-4xl">Da campanha ao pagamento</CardTitle>
                <CardDescription className="text-sm md:text-base">
                  Somma organiza movimentos musicais com páginas conectadas, envios verificados e carteira integrada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  "Criadores conectam TikTok e páginas sociais autorizadas.",
                  "Campanhas definem música, regras, plataformas e tags obrigatórias.",
                  "A equipe aprova envios, sincroniza métricas e libera pagamento.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-background/70 p-4 border border-[hsl(var(--somma-pink))]/10">
                    <CheckCircle className="h-5 w-5 text-[hsl(var(--somma-pink))] mt-0.5" />
                    <p>{item}</p>
                  </div>
                ))}

                <div className="pt-2">
                  <Button asChild size="lg" className="rounded-full hover:bg-[hsl(var(--somma-pink))] hover:text-white">
                    <Link to="/auth">Criar conta gratuita</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="sobre" className="container mx-auto px-4">
          <Card className="somma-panel somma-card-hover rounded-[2rem] text-center reveal-on-scroll">
            <CardHeader className="space-y-4 pt-12">
              <TrendingUp className="h-10 w-10 text-[hsl(var(--somma-pink))] mx-auto" />
              <CardTitle className="font-display text-4xl md:text-5xl font-black">
                Pronto para lançar o próximo movimento?
              </CardTitle>
              <CardDescription className="text-base md:text-lg max-w-2xl mx-auto">
                Use a Somma para reunir criadores, acompanhar resultados e transformar música em cultura.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-12">
              <Button size="lg" asChild className="rounded-full shadow-pink-glow bg-[hsl(var(--somma-pink))] text-white hover:bg-primary hover:text-primary-foreground">
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
