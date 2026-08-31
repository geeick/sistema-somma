import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Disc3 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen somma-shell flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center page-enter">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Disc3 className="h-8 w-8" />
        </div>
        <p className="app-eyebrow justify-center">Erro 404</p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-[-0.05em]">Página não encontrada</h1>
        <p className="mt-4 text-muted-foreground text-base leading-relaxed">
          O endereço que você tentou abrir não existe ou foi movido.
        </p>
        <Button asChild className="mt-7 rounded-xl px-6 font-extrabold">
          <a href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao início
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
