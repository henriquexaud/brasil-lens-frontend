import { useEffect, useRef } from 'react';

// Abre o <dialog> nativo como modal ao montar. Sem `close()` na limpeza: ao sair do DOM o
// diálogo deixa a camada do topo, e o `close()` dispararia `onClose` (no StrictMode, logo
// depois de abrir).
export function useModalDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    // O `autoFocus` do React age antes do `showModal`, que leva o foco ao primeiro link.
    dialog.current.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  return dialog;
}
