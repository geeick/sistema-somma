import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getNeonUser, signOutNeon, type NeonUser } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import sommaLogo from "@/assets/somma-logo.png";
import { useUserRole } from "@/hooks/useUserRole";

const publicNavLinks = [
  { label: "Descobrir", href: "/#descobrir" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Criadores", href: "/#criadores" },
  { label: "Sobre", href: "/#sobre" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const { isAdmin, isLoading } = useUserRole();

  useEffect(() => {
    getNeonUser().then(setUser).catch(() => setUser(null));
  }, []);

  const handleSignOut = async () => {
    await signOutNeon();
    navigate("/");
  };

  const logoLink = user && isAdmin ? "/admin" : "/";

  return (
    <nav className="fixed top-0 w-full z-50 somma-nav backdrop-blur-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to={logoLink} className="flex items-center gap-3">
          <img src={sommaLogo} alt="Somma" className="h-8 drop-shadow" />
        </Link>

        <div className="hidden md:flex items-center gap-2 text-sm text-secondary-foreground/80">
          {!user && (
            <>
              {publicNavLinks.map((link) => (
                <a key={link.href} href={link.href} className="px-3 py-2 hover:text-primary transition-colors">
                  {link.label}
                </a>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!isLoading && isAdmin ? (
                <>
                  <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                    <Link to="/admin">Painel</Link>
                  </Button>

                  <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                    <Link to="/admin/campaigns">Campanhas</Link>
                  </Button>

                  <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                    <Link to="/admin/submissions">Envios</Link>
                  </Button>

                  <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                    <Link to="/admin/creators">Criadores</Link>
                  </Button>

                  <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                    <Link to="/admin/wallet">Carteira</Link>
                  </Button>
                </>
              ) : (
                !isLoading && (
                  <>
                    <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                      <Link to="/dashboard">Início</Link>
                    </Button>

                    <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                      <Link to="/campaigns">Campanhas</Link>
                    </Button>

                    <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                      <Link to="/pages">Páginas</Link>
                    </Button>

                    <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                      <Link to="/wallet">Carteira</Link>
                    </Button>
                  </>
                )
              )}

              <Button variant="outline" onClick={handleSignOut} className="border-primary/50 bg-transparent text-secondary-foreground hover:bg-primary hover:text-primary-foreground">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-secondary-foreground hover:text-primary hover:bg-primary/10">
                <Link to="/auth">Entrar</Link>
              </Button>

              <Button asChild className="rounded-full shadow-glow">
                <Link to="/auth">Começar</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
