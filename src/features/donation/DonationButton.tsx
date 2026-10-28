import { useEffect, useRef, useState } from 'react';

function PixMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"
        fill="currentColor"
      />
    </svg>
  );
}

// QR estático gerado no app do banco, sem valor fixo: quem doa escolhe quanto.
const PIX_QR_SRC = '/pix-qr.png';
// O mesmo Pix em "copia e cola", para quem abre o site no celular e não tem como escanear.
const PIX_CODE =
  '00020126670014br.gov.bcb.pix0124xxhenriquexaud@gmail.com0217Doacao_Voluntaria5204000053039865802BR5925HENRIQUE_ABRAHIM_RAMALHO_6015SAO_JOSE_DOS_CA62290525hFhKFMRm0Ds1BBuR6j4VJijrz6304C76E';

function DonationDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    // Sem `close()` na limpeza: ao sair do DOM o diálogo deixa a camada do topo, e o
    // `close()` dispararia `onClose` (no StrictMode, logo depois de abrir).
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="donation-dialog"
      aria-labelledby="donation-title"
      onClose={onClose}
      onClick={(event) => {
        // Clique no fundo escurecido fecha; dentro do cartão, não.
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="donation-card">
        <header className="donation-header">
          <span className="donation-badge">
            <PixMark size={16} />
            Pix
          </span>
          <h2 id="donation-title">Apoie o Brasil Lens</h2>
          <button type="button" className="donation-close" aria-label="Fechar" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <img className="donation-qr" src={PIX_QR_SRC} alt="QR Code Pix para doação" />
        <p className="donation-note">Aponte a câmera do app do banco. Qualquer valor ajuda.</p>
        <button
          type="button"
          className="donation-copy"
          onClick={() => {
            void navigator.clipboard.writeText(PIX_CODE).then(() => setCopied(true));
          }}
        >
          {copied ? 'Código copiado' : 'Copiar código Pix'}
        </button>
      </div>
    </dialog>
  );
}

export function DonationButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="donation-button"
        aria-label="Apoiar o Brasil Lens com Pix"
        aria-haspopup="dialog"
        title="Apoiar com Pix"
        onClick={() => setOpen(true)}
      >
        <PixMark />
        <span className="donation-button-hint" aria-hidden="true">
          Apoiar com Pix
        </span>
      </button>
      {open && <DonationDialog onClose={() => setOpen(false)} />}
    </>
  );
}
