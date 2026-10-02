import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const frontend = fileURLToPath(new URL('../..', import.meta.url));
const scratchDirs = [];

// O DOM precisa existir antes de importar react-dom; chame no topo do teste.
export function installDom(html = '<!doctype html><div id="root"></div>') {
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  return dom;
}

// Compila módulos de `src/` (alias `@/`, TSX) e devolve o namespace do bundle.
// `external` fica fora do bundle para que o teste e o código compartilhem a mesma instância.
export async function loadModule(
  contents,
  { external = ['react', 'react-dom', '@tanstack/react-query'], stubs = {} } = {},
) {
  const compiled = await build({
    stdin: { contents, resolveDir: frontend, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    alias: { '@': join(frontend, 'src') },
    external,
    plugins: [
      {
        name: 'stubs',
        setup(builder) {
          for (const [name, source] of Object.entries(stubs)) {
            builder.onResolve({ filter: new RegExp(`^${name}$`) }, () => ({
              path: name,
              namespace: 'stub',
            }));
            builder.onLoad({ filter: new RegExp(`^${name}$`), namespace: 'stub' }, () => ({
              contents: source,
            }));
          }
        },
      },
    ],
  });
  const scratch = await mkdtemp(join(frontend, 'node_modules', '.harness-'));
  scratchDirs.push(scratch);
  const path = join(scratch, 'bundle.mjs');
  await writeFile(path, compiled.outputFiles[0].text);
  return import(pathToFileURL(path).href);
}

export async function disposeHarness() {
  await Promise.all(scratchDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}
