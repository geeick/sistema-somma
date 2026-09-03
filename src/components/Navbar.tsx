import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNeonUser, signOutNeon, type NeonUser } from "@/lib/auth";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import sommaLogo from "@/assets/somma-logo.png";
import { useUserRole } from "@/hooks/useUserRole";

const publicNavLinks = [
  { label: "Descobrir", href: "/#descobrir" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Para criadores", href: "/#criadores" },
  { label: "Sobre a Somma", href: "/#sobre" },
];

const adminNavLinks = [
  { label: "Painel", href: "/admin" },
  { label: "Campanhas", href: "/admin/campaigns" },
  { label: "Envios", href: "/admin/submissions" },
  { label: "Criadores", href: "/admin/creators" },
  { label: "Carteira", href: "/admin/wallet" },
];

const creatorNavLinks = [
  { label: "Início", href: "/dashboard" },
  { label: "Campanhas", href: "/campaigns" },
  { label: "Páginas", href: "/pages" },
  { label: "Carteira", href: "/wallet" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const isActive = (href: string) =>
    href === "/admin" || href === "/dashboard"
      ? location.pathname === href
      : location.pathname.startsWith(href);

  const routeButtonClass = (href: string) =>
    `nav-route-link text-secondary-foreground hover:text-white hover:bg-white/5 ${isActive(href) ? "is-active" : ""}`;
  const authenticatedLinks = isAdmin ? adminNavLinks : creatorNavLinks;

  return (
    <nav className="fixed top-0 w-full z-50 somma-nav backdrop-blur-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to={logoLink} className="somma-logo-link flex items-center gap-3" aria-label="Página inicial da Somma">
          <span className="somma-logo-halo"><img src={sommaLogo} alt="Somma" className="h-8 drop-shadow" /></span>
        </Link>

        <div className="hidden md:flex items-center gap-2 text-sm text-secondary-foreground/80">
          {!user && (
            <>
              {publicNavLinks.map((link) => (
                <a key={link.href} href={link.href} className="px-3 py-2 hover:text-[hsl(var(--somma-pink))] transition-colors">
                  {link.label}
                </a>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!isLoading && (
                <>
                  <div className="hidden lg:flex items-center gap-1">
                    {authenticatedLinks.map((link) => (
                      <Button key={link.href} variant="ghost" asChild className={routeButtonClass(link.href)}>
                        <Link to={link.href}>{link.label}</Link>
                      </Button>
                    ))}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="lg:hidden border-white/15 bg-white/5 text-white hover:bg-[hsl(var(--somma-pink))]/15" aria-label="Abrir navegação">
                        <Menu className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-2">
                      {authenticatedLinks.map((link) => (
                        <DropdownMenuItem key={link.href} asChild className={isActive(link.href) ? "bg-[hsl(var(--somma-pink-soft))] text-[hsl(var(--somma-pink-deep))] font-bold" : ""}>
                          <Link to={link.href}>{link.label}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              <Button variant="outline" onClick={handleSignOut} className="border-[hsl(var(--somma-pink))]/45 bg-transparent text-secondary-foreground hover:bg-[hsl(var(--somma-pink))] hover:text-white">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-secondary-foreground hover:text-[hsl(var(--somma-pink))] hover:bg-[hsl(var(--somma-pink))]/10">
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
