import { Link } from "react-router-dom";
import { ArrowUpRight, Instagram, Mail, Music2, Play, Youtube } from "lucide-react";
import sommaLogo from "@/assets/somma-logo.png";

const productLinks = [
  { label: "Descobrir", href: "/#descobrir" },
  { label: "Como funciona", href: "/#como-funciona" },
  { label: "Para criadores", href: "/#criadores" },
  { label: "Sobre a Somma", href: "/#sobre" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Rodapé da Somma">
      <div className="container mx-auto px-4">
        <div className="footer-cta">
          <div>
            <span className="footer-kicker"><Music2 className="h-4 w-4" /> Somma</span>
            <h2 className="font-display">Música que circula. Criadores que crescem.</h2>
          </div>
          <Link to="/auth" className="footer-cta-link">
            Entrar na Somma <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-logo" aria-label="Página inicial da Somma">
              <span className="somma-logo-halo"><img src={sommaLogo} alt="Somma" /></span>
            </Link>
            <p>
              Campanhas musicais, conteúdo verificado e pagamentos reunidos em uma experiência feita para a cultura digital.
            </p>
            <div className="footer-platforms" aria-label="Plataformas compatíveis">
              <span title="Instagram"><Instagram /></span>
              <span title="TikTok"><Play /></span>
              <span title="YouTube"><Youtube /></span>
            </div>
          </div>

          <nav className="footer-column" aria-label="Produto">
            <p>Produto</p>
            {productLinks.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>

          <nav className="footer-column" aria-label="Informações legais">
            <p>Legal</p>
            <Link to="/privacy">Política de Privacidade</Link>
            <Link to="/terms">Termos de Serviço</Link>
          </nav>

          <div className="footer-column footer-contact">
            <p>Contato</p>
            <a href="mailto:georgiaeick@g.ucla.edu">
              <Mail className="h-4 w-4" /> georgiaeick@g.ucla.edu
            </a>
            <span>Atendimento e solicitações de privacidade</span>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Somma. Todos os direitos reservados.</span>
          <span>Feito para amplificar a música brasileira.</span>
        </div>
      </div>
    </footer>
  );
}
