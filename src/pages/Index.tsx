import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Link, Navigate } from "react-router-dom";
import { CheckCircle, Music2, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";

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
          <div className="mx-auto max-w-[1320px]">
            <div className="somma-dark-panel somma-grain rounded-[2rem] overflow-hidden grid lg:grid-cols-[1.02fr_0.98fr] items-stretch">
              <div className="relative z-10 p-7 md:p-12 lg:p-14 min-h-[540px] flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f7ead1]/22 bg-[#f7ead1]/8 px-4 py-2 text-xs font-bold text-[#f7ead1] w-fit mb-7 uppercase tracking-[0.16em] font-ui">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--somma-pink))]" />
                  Somma para campanhas de música e criadores
                </div>

                <h1 className="font-display max-w-[720px] text-[clamp(3.2rem,5.4vw,6.1rem)] leading-[0.9] font-black tracking-[-0.045em] text-[#f7ead1] drop-shadow mb-7">
                  Transforme músicas em movimentos culturais
                </h1>

                <p className="max-w-[570px] font-ui text-base md:text-lg text-[#f7ead1]/82 mb-8 leading-relaxed">
                  A Somma conecta artistas, marcas e criadores para lançar campanhas, medir impacto e pagar criadores com clareza.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild className="rounded-full bg-primary px-7 text-primary-foreground hover:bg-accent shadow-glow font-ui font-bold transition-all duration-300">
                    <Link to="/auth">Começar um movimento</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="rounded-full border-[#f7ead1]/35 bg-transparent px-7 text-[#f7ead1] hover:border-[hsl(var(--somma-pink))]/70 hover:bg-[hsl(var(--somma-pink))]/12 hover:text-[#f7ead1] font-ui font-bold transition-all duration-300">
                    <Link to="/auth">Explorar campanhas →</Link>
                  </Button>
                </div>
              </div>

              <div className="hero-art-card">
                <div className="vinyl-sleeve" />

                <div className="record-scene" aria-hidden="true">
                  <div className="record-disc" />
                  <div className="record-label-ring" />
                  <div className="record-label-core">
                    <span className="font-display text-2xl font-black tracking-[-0.03em]">somma</span>
                  </div>
                </div>

                <div className="hero-mini-card p-5">
                  <p className="font-ui text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[hsl(var(--somma-pink))] mb-3">
                    Campanha ativa
                  </p>
                  <p className="font-display text-2xl font-black leading-none mb-3">
                    música + criadores
                  </p>
                  <div className="flex items-center justify-between rounded-full bg-white/60 px-3 py-2 text-xs font-bold text-muted-foreground">
                    <span>impacto</span>
                    <span className="text-foreground">+24%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="somma-panel rounded-b-[2rem] border-t-0 px-5 py-5 overflow-hidden">
              <div className="mb-4 flex items-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--somma-pink))] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-pink-glow font-ui">
                  <Sparkles className="h-3.5 w-3.5" />
                  Artistas participantes
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
          </div>
        </section>

        <section id="como-funciona" className="container mx-auto px-4 py-16">
          <div className="text-center max-w-3xl mx-auto mb-10 reveal-on-scroll">
            <h2 className="font-display text-4xl md:text-5xl font-black mb-4">Como funciona</h2>
            <p className="font-ui text-base md:text-lg text-muted-foreground">
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
                  <CardDescription className="font-ui text-sm md:text-base text-muted-foreground">
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
                <CardDescription className="font-ui text-[#f7ead1]/75">
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
                    <p className="font-ui text-xs text-muted-foreground mb-2">{label}</p>
                    <p className="font-display text-2xl md:text-3xl font-black">{value}</p>
                    <p className="font-ui text-xs text-green-700 mt-2">{note}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="somma-panel somma-card-hover rounded-[2rem] reveal-on-scroll">
              <CardHeader>
                <CardTitle className="font-display text-3xl md:text-4xl">Da campanha ao pagamento</CardTitle>
                <CardDescription className="font-ui text-sm md:text-base">
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
                    <p className="font-ui">{item}</p>
                  </div>
                ))}

                <div className="pt-2">
                  <Button asChild size="lg" className="rounded-full hover:bg-[hsl(var(--somma-pink))] hover:text-white font-ui font-bold">
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
              <CardDescription className="font-ui text-base md:text-lg max-w-2xl mx-auto">
                Use a Somma para reunir criadores, acompanhar resultados e transformar música em cultura.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-12">
              <Button size="lg" asChild className="rounded-full shadow-pink-glow bg-[hsl(var(--somma-pink))] text-white hover:bg-primary hover:text-primary-foreground font-ui font-bold">
                <Link to="/auth">Entrar na Somma</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;
