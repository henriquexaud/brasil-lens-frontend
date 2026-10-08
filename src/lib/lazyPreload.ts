import { createElement, lazy, useRef, type ComponentProps, type ComponentType } from 'react';

// `lazy` com `preload()`: o código pode chegar antes do primeiro uso (ocioso ou
// logo antes de uma troca). Com o módulo já em mãos o componente renderiza
// direto; o `lazy` do React suspende ao menos uma vez mesmo com a promessa
// resolvida, e o Suspense trocava por um quadro o que estava na tela pelo
// fallback (o painel encolhia e crescia de novo).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesma restrição de React.lazy
export function lazyPreload<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  let loaded: T | undefined;
  let pending: Promise<{ default: T }> | undefined;
  const once = () =>
    (pending ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        pending = undefined; // uma falha de rede não fica guardada: a próxima tentativa recarrega
        throw error;
      },
    ));
  const Suspended = lazy(once);
  function Preloadable(props: ComponentProps<T>) {
    // Decidido na montagem: trocar de tipo depois remontaria o componente.
    const direct = useRef(loaded).current;
    return createElement(direct ?? Suspended, props);
  }
  return Object.assign(Preloadable, {
    // Nunca rejeita: quem pré-carrega só quer adiantar; o erro aparece no uso.
    preload: (): Promise<void> =>
      once().then(
        () => undefined,
        () => undefined,
      ),
  });
}
