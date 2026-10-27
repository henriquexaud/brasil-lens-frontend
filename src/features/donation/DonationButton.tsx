import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LADDER,
  MAX_CENTS,
  MIN_CENTS,
  PIECES,
  fakeQr,
  formatCents,
  ladderIndex,
  raise,
  thanks,
  type Piece,
} from './donation';

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

function FakeQr({ cents }: { cents: number }) {
  const modules = useMemo(() => fakeQr(`brasil-lens:${cents}`), [cents]);
  const size = modules.length;
  const path = modules
    .flatMap((row, r) => row.map((on, c) => (on ? `M${c} ${r}h1v1h-1z` : '')))
    .join('');
  return (
    <div className="donation-qr" aria-label="QR Code ilustrativo, não é um Pix válido" role="img">
      <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} shapeRendering="crispEdges">
        <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#ffffff" />
        <path d={path} fill="#0F2530" />
      </svg>
      <span className="donation-qr-mark">
        <PixMark size={26} />
      </span>
    </div>
  );
}

function PieceButton({
  piece,
  disabled,
  onAdd,
}: {
  piece: Piece;
  disabled: boolean;
  onAdd: (cents: number) => void;
}) {
  return (
    <button
      type="button"
      className="donation-piece"
      style={{ ['--piece-tone' as string]: piece.tone, ['--piece-ink' as string]: piece.ink }}
      disabled={disabled}
      title={`Somar ${formatCents(piece.cents)}`}
      aria-label={`Somar ${formatCents(piece.cents)}`}
      onClick={() => onAdd(piece.cents)}
    >
      <span>{piece.label}</span>
    </button>
  );
}

function DonationDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cents, setCents] = useState(MIN_CENTS);
  const [raises, setRaises] = useState(0);
  const full = cents >= MAX_CENTS;

  useEffect(() => {
    // Sem `close()` na limpeza: ao sair do DOM o diálogo deixa a camada do topo, e o
    // `close()` dispararia `onClose` (no StrictMode, logo depois de abrir).
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const update = (next: number) => {
    const value = raise(cents, next);
    if (value === cents) return;
    setCents(value);
    setRaises((count) => count + 1);
  };
  const step = ladderIndex(cents);

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

        <div className="donation-body">
          <FakeQr cents={cents} />
          <div className="donation-amount">
            <span className="donation-amount-label">Valor da doação</span>
            <output className="donation-value" aria-live="polite">
              {formatCents(cents)}
            </output>
            <p className="donation-thanks" aria-live="polite" key={raises}>
              {thanks(raises, cents)}
            </p>
          </div>
        </div>

        <label className="donation-slider">
          <span className="sr-only">Valor da doação</span>
          <input
            type="range"
            min={0}
            max={LADDER.length - 1}
            step={1}
            value={step}
            disabled={full}
            style={{ ['--fill' as string]: `${(step / (LADDER.length - 1)) * 100}%` }}
            aria-valuetext={formatCents(cents)}
            onChange={(event) => update(LADDER[Number(event.target.value)] ?? cents)}
          />
          <span className="donation-slider-ends" aria-hidden="true">
            <span>R$ 0,05</span>
            <span>R$ 200</span>
          </span>
        </label>

        <div className="donation-pieces" role="group" aria-label="Somar cédulas">
          {PIECES.map((piece) => (
            <PieceButton
              key={piece.cents}
              piece={piece}
              disabled={full}
              onAdd={(value) => update(cents + value)}
            />
          ))}
        </div>

        <p className="donation-note">
          Demonstração: o QR Code é ilustrativo e ainda não recebe doações.
        </p>
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
