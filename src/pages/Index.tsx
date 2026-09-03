import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle,
  Instagram,
  Megaphone,
  Music2,
  Play,
  ShieldCheck,
  Sparkles,
  Wallet,
  Youtube,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getNeonUser, type NeonUser } from "@/lib/auth";

const steps = [
  {
    icon: ShieldCheck,
    title: "Conecte suas contas",
    description: "Autorize Instagram, TikTok ou YouTube pela própria plataforma social.",
  },
  {
    icon: Megaphone,
    title: "Escolha uma campanha",
    description: "Confira briefing, prazo, plataformas, tags e regras de pagamento.",
  },
  {
    icon: Music2,
    title: "Envie seu conteúdo",
    description: "Selecione uma publicação da conta conectada e envie para análise.",
  },
  {
    icon: Wallet,
    title: "Acompanhe e receba",
    description: "Veja métricas, aprovação, saldo disponível e histórico de saques.",
  },
];

const creatorBenefits = [
  {
    icon: ShieldCheck,
    title: "Páginas verificadas",
    description: "Sua conta e suas publicações são confirmadas pela integração autorizada.",
  },
  {
    icon: BarChart3,
    title: "Métricas organizadas",
    description: "Visualizações, curtidas e outros dados elegíveis ficam ligados ao envio certo.",
  },
  {
    icon: Wallet,
    title: "Pagamentos transparentes",
    description: "Acompanhe aprovação, saldo e solicitações de saque em um único lugar.",
  },
];

const Index = () => {
  const [user, setUser] = useState<NeonUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNeonUser()
      .then((currentUser) => {
        setUser(currentUser);
        setIsLoading(false);
      })
      .catch(() => {
        setUser(null);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell flex items-center justify-center px-6">
        <LoadingState label="Carregando a Somma..." className="w-full max-w-sm" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen somma-shell text-foreground">
      <Navbar />

      <main className="pt-24 pb-16">
        <section id="descobrir" className="container mx-auto px-4 scroll-mt-24">
          <div className="mx-auto max-w-[1320px]">
            <div className="somma-dark-panel somma-grain rounded-[2rem] overflow-hidden grid lg:grid-cols-[1.05fr_0.95fr] items-stretch">
              <div className="relative z-10 p-7 md:p-12 lg:p-14 min-h-[540px] flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f7ead1]/20 bg-[#f7ead1]/8 px-4 py-2 text-xs font-bold text-[#f7ead1] w-fit mb-7 uppercase tracking-[0.16em] font-ui">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--somma-pink))]" />
                  Campanhas de música feitas com criadores
                </div>

                <h1 className="font-display max-w-[720px] text-[clamp(3.2rem,5.4vw,6.1rem)] leading-[0.9] font-black tracking-[-0.045em] text-[#f7ead1] mb-7">
                  Transforme música em movimento.
                </h1>

                <p className="max-w-[590px] font-ui text-base md:text-lg text-[#f7ead1]/78 mb-8 leading-relaxed">
                  A Somma conecta artistas e criadores em campanhas claras, com conteúdo verificado, métricas organizadas e pagamentos rastreáveis.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild className="rounded-full px-7 font-ui font-bold shadow-glow">
                    <Link to="/auth">Criar conta</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="rounded-full border-[#f7ead1]/30 bg-transparent px-7 text-[#f7ead1] hover:border-[hsl(var(--somma-pink))]/70 hover:bg-[hsl(var(--somma-pink))]/12 hover:text-[#f7ead1] font-ui font-bold">
                    <Link to="/auth">Ver campanhas</Link>
                  </Button>
                </div>

                <div className="landing-platform-row mt-10 flex flex-wrap items-center gap-2 text-xs font-bold text-[#f7ead1]/62">
                  <span className="mr-1">Conecte:</span>
                  <span className="landing-platform-pill"><Instagram /> Instagram</span>
                  <span className="landing-platform-pill"><Play /> TikTok</span>
                  <span className="landing-platform-pill"><Youtube /> YouTube Shorts</span>
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
                    Tudo conectado
                  </p>
                  <p className="font-display text-2xl font-black leading-none mb-3">campanha + conteúdo</p>
                  <div className="flex items-center gap-2 rounded-full bg-white/60 px-3 py-2 text-xs font-bold text-foreground">
                    <CheckCircle className="h-4 w-4 text-green-700" /> Métricas verificadas
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="container mx-auto px-4 py-20 scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-10 reveal-on-scroll">
            <p className="pink-kicker justify-center">Simples do início ao pagamento</p>
            <h2 className="font-display text-4xl md:text-5xl font-black mb-4">Como funciona</h2>
            <p className="font-ui text-base md:text-lg text-muted-foreground">
              Um fluxo direto para participar de campanhas sem planilhas ou mensagens espalhadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {steps.map((step, index) => (
              <Card key={step.title} className="somma-panel somma-card-hover rounded-[1.5rem] reveal-on-scroll">
                <CardHeader>
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-black tracking-[0.12em] text-[hsl(var(--somma-pink))]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <CardTitle className="font-display text-2xl">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="font-ui text-sm leading-relaxed">{step.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="criadores" className="container mx-auto px-4 pb-20 scroll-mt-24">
          <Card className="somma-panel rounded-[2rem] overflow-hidden reveal-on-scroll">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="p-7 md:p-12 lg:p-14 flex flex-col justify-center">
                <p className="pink-kicker">Para criadores</p>
                <h2 className="font-display mt-3 text-4xl md:text-5xl font-black leading-[0.98]">
                  Oportunidades e pagamentos no mesmo lugar.
                </h2>
                <p className="mt-5 max-w-xl text-muted-foreground text-base md:text-lg leading-relaxed">
                  Descubra campanhas compatíveis com seu conteúdo, envie publicações de contas conectadas e acompanhe cada etapa até o saque.
                </p>
                <Button asChild size="lg" className="mt-7 rounded-full w-fit font-bold">
                  <Link to="/auth">Começar como criador</Link>
                </Button>
              </div>

              <div className="creator-benefit-list">
                {creatorBenefits.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="creator-benefit-item">
                    <span><Icon /></span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section id="sobre" className="container mx-auto px-4 scroll-mt-24">
          <Card className="somma-dark-panel somma-grain rounded-[2rem] overflow-hidden reveal-on-scroll">
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end p-7 md:p-12 lg:p-14">
              <div className="max-w-3xl">
                <p className="pink-kicker">Sobre a Somma</p>
                <h2 className="font-display mt-3 text-4xl md:text-5xl font-black text-[#f7ead1] leading-[0.98]">
                  Uma operação mais clara para quem lança e para quem cria.
                </h2>
                <p className="homepage-about-copy mt-5 text-base md:text-lg leading-relaxed">
                  Artistas, equipes e marcas organizam briefing, plataformas, regras e orçamento. Criadores encontram oportunidades, enviam conteúdo e acompanham resultados — tudo dentro da mesma campanha.
                </p>
              </div>
              <Button size="lg" asChild className="rounded-full bg-[hsl(var(--somma-pink))] text-white hover:bg-primary hover:text-primary-foreground font-bold shadow-pink-glow">
                <Link to="/auth">Entrar na Somma</Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
