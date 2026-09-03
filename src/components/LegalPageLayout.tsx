import type { ReactNode } from "react";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageLayoutProps = {
  kind: "privacy" | "terms";
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

export function LegalPageLayout({ kind, eyebrow, title, description, sections }: LegalPageLayoutProps) {
  const Icon = kind === "privacy" ? ShieldCheck : FileText;

  return (
    <div className="min-h-screen somma-shell text-foreground">
      <Navbar />
      <main className="legal-page">
        <div className="container mx-auto px-4">
          <Link to="/" className="legal-back"><ArrowLeft /> Voltar para o início</Link>

          <header className="legal-hero somma-grain">
            <div className="legal-icon"><Icon /></div>
            <p className="pink-kicker">{eyebrow}</p>
            <h1 className="font-display">{title}</h1>
            <p>{description}</p>
            <span>Última atualização: 3 de setembro de 2026</span>
          </header>

          <div className="legal-grid">
            <aside className="legal-toc">
              <p>Nesta página</p>
              <nav aria-label={`Sumário de ${title}`}>
                {sections.map((section, index) => (
                  <a key={section.id} href={`#${section.id}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>{section.title}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="legal-content">
              {sections.map((section, index) => (
                <section key={section.id} id={section.id} className="legal-section">
                  <div className="legal-section-heading">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h2>{section.title}</h2>
                  </div>
                  <div className="legal-copy">{section.content}</div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}
