import { useEffect } from 'react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { PRIVACY, TERMS } from './content';
import { CONTACT_EMAIL, LEGAL_PATHS, LEGAL_UPDATED, type LegalDocument } from './routes';
import './legal.css';

const TEXTS = { privacy: PRIVACY, terms: TERMS };

export default function LegalPage({ document: kind }: { document: LegalDocument }) {
  const text = TEXTS[kind];

  useEffect(() => {
    const previous = window.document.title;
    window.document.title = `${text.title} · Brasil Lens`;
    return () => {
      window.document.title = previous;
    };
  }, [text.title]);

  return (
    <div className="app legal-page">
      <header className="legal-header">
        <a className="auth-brand legal-brand" href="/">
          <img src="/logo-192.png?v=3" width="32" height="32" alt="" />
          <span>
            Brasil <strong>Lens</strong>
          </span>
        </a>
        <nav className="legal-switch" aria-label="Documentos">
          {(['privacy', 'terms'] as const).map((item) => (
            <a
              key={item}
              href={LEGAL_PATHS[item]}
              aria-current={item === kind ? 'page' : undefined}
            >
              {item === 'privacy' ? 'Privacidade' : 'Termos'}
            </a>
          ))}
        </nav>
      </header>
      <main className="legal-article">
        <p className="legal-version">Versão de {LEGAL_UPDATED}</p>
        <h1>{text.title}</h1>
        <section className="legal-summary" aria-labelledby="legal-summary-title">
          <h2 id="legal-summary-title">Em resumo</h2>
          {text.summary}
        </section>
        <nav className="legal-toc" aria-label="Seções">
          <ol>
            {text.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, '')}</a>
              </li>
            ))}
          </ol>
        </nav>
        {text.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.body}
          </section>
        ))}
        <footer className="legal-footer">
          <p>
            Dúvidas ou pedidos: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
          <a href="/">← Voltar ao Brasil Lens</a>
        </footer>
      </main>
      <ThemeSwitch />
    </div>
  );
}
