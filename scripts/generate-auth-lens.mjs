// Gera src/features/auth/authLensArt.ts: a arte da lente animada da tela de acesso.
// A malha de territórios é uma só. Cada contexto (clima, socioeconômico, político)
// só troca as cores das células e o que é desenhado por cima, e é isso que permite
// a troca em onda sem que as divisas se mexam. Cada célula sai com as cores dos
// dois temas, sorteadas juntas, para o claro e o escuro serem o mesmo desenho.
//
// Uso: node scripts/generate-auth-lens.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CENTER = [760, 787];
const RADIUS = 578;
// Sobra de mapa além do aro, para a lente poder se deslocar até o foco.
const MARGIN = 70;
const PAN = 0.16;
const CONTEXTS = ['climate', 'socioeconomic', 'political'];
const FOCUS = { climate: [968, 752], socioeconomic: [548, 612], political: [566, 1004] };

// ---------------------------------------------------------------- utils --
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) =>
  '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const [x, y] = [rgb(a), rgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const ramp = (colors, t) => {
  const p = clamp(t) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(p));
  return mix(colors[i], colors[i + 1], p - i);
};
const blob = (p, [x, y, r]) => Math.exp(-((p[0] - x) ** 2 + (p[1] - y) ** 2) / (2 * r * r));
const point = (p) => [Math.round(p[0]), Math.round(p[1])];
const key = (p) => `${p[0]},${p[1]}`;
const polyline = (points, closed = false) =>
  'M' + points.map((p) => `${p[0]} ${p[1]}`).join('L') + (closed ? 'Z' : '');
const pathLength = (points) => points.slice(1).reduce((sum, p, i) => sum + dist(p, points[i]), 0);

// -------------------------------------------------------------- voronoi --
// Células menores perto dos três focos, como municípios em torno de uma capital.
function buildMesh(seed) {
  const rand = rng(seed);
  const half = RADIUS + MARGIN + 130;
  const lo = [CENTER[0] - half, CENTER[1] - half];
  const size = 2 * half;
  const foci = Object.values(FOCUS);
  const spacing = (p) =>
    Math.min(...foci.map((focus) => 47 + 45 * smooth((dist(p, focus) - 50) / 360)));
  let sites = [];
  for (let i = 0; i < 26000; i++) {
    const p = [lo[0] + rand() * size, lo[1] + rand() * size];
    const rp = spacing(p);
    if (sites.every((q) => dist(p, q) > 0.5 * (rp + spacing(q)))) sites.push(p);
  }
  const box = [
    [lo[0], lo[1]],
    [lo[0] + size, lo[1]],
    [lo[0] + size, lo[1] + size],
    [lo[0], lo[1] + size],
  ];
  // Recorte por semiplanos; cada aresta guarda o vizinho que a criou.
  const cellsOf = (pts) =>
    pts.map((s, i) => {
      let poly = box.map((v) => ({ v, tag: -1 }));
      for (let j = 0; j < pts.length && poly.length; j++) {
        if (j === i) continue;
        const o = pts[j];
        const n = [o[0] - s[0], o[1] - s[1]];
        const k = (o[0] ** 2 + o[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2;
        const side = (v) => v[0] * n[0] + v[1] * n[1] - k;
        const out = [];
        for (let e = 0; e < poly.length; e++) {
          const a = poly[e];
          const b = poly[(e + 1) % poly.length];
          const sa = side(a.v);
          const sb = side(b.v);
          const cut = () => {
            const t = sa / (sa - sb);
            return [a.v[0] + (b.v[0] - a.v[0]) * t, a.v[1] + (b.v[1] - a.v[1]) * t];
          };
          if (sa <= 0 && sb <= 0) out.push(a);
          else if (sa <= 0) out.push(a, { v: cut(), tag: j });
          else if (sb <= 0) out.push({ v: cut(), tag: a.tag });
        }
        poly = out;
      }
      return poly;
    });
  const centroid = (poly) => {
    let [a, x, y] = [0, 0, 0];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const c = p.v[0] * q.v[1] - q.v[0] * p.v[1];
      a += c;
      x += (p.v[0] + q.v[0]) * c;
      y += (p.v[1] + q.v[1]) * c;
    });
    return [x / (3 * a), y / (3 * a)];
  };
  // Uma passada de Lloyd arredonda as células sem apagar a variação de densidade.
  sites = cellsOf(sites).map(centroid);
  const cells = cellsOf(sites).map((poly) => poly.map((p) => ({ v: point(p.v), tag: p.tag })));
  const keep = cells.map((poly) => poly.some((p) => dist(p.v, CENTER) < RADIUS + MARGIN + 4));
  return { sites, cells, keep };
}

// Arestas da malha escolhidas por um predicado sobre as duas células vizinhas.
function edges(mesh, pick) {
  const out = [];
  mesh.cells.forEach((poly, i) => {
    if (!mesh.keep[i]) return;
    poly.forEach((p, e) => {
      const q = poly[(e + 1) % poly.length];
      if (p.tag < 0 || key(p.v) === key(q.v) || !pick(i, p.tag)) return;
      out.push([p.v, q.v]);
    });
  });
  return out;
}

// Emenda arestas soltas em traçados contínuos, parando nos entroncamentos.
function chain(segments) {
  const touching = new Map();
  segments.forEach((segment, index) => {
    for (const p of segment) {
      if (!touching.has(key(p))) touching.set(key(p), []);
      touching.get(key(p)).push(index);
    }
  });
  const used = new Set();
  const walk = (start, first) => {
    const points = [start];
    let at = start;
    let index = first;
    while (index !== undefined && !used.has(index)) {
      used.add(index);
      const [a, b] = segments[index];
      at = key(a) === key(at) ? b : a;
      points.push(at);
      const around = touching.get(key(at));
      index = around.length === 2 ? around.find((other) => !used.has(other)) : undefined;
    }
    return points;
  };
  const chains = [];
  segments.forEach((segment, index) => {
    for (const end of segment) {
      if (touching.get(key(end)).length !== 2 && !used.has(index)) chains.push(walk(end, index));
    }
  });
  segments.forEach((segment, index) => {
    if (!used.has(index)) chains.push(walk(segment[0], index));
  });
  return chains;
}

// Catmull-Rom → Bézier.
function curve(points, tension) {
  let d = `M${Math.round(points[0][0])} ${Math.round(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const k = tension / 3;
    const n = [
      p1[0] + (p2[0] - p0[0]) * k,
      p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k,
      p2[1] - (p3[1] - p1[1]) * k,
      p2[0],
      p2[1],
    ];
    d += 'C' + n.map((v) => Math.round(v)).join(' ');
  }
  return d;
}

// ---------------------------------------------------------------- cores --
// Cada função devolve, por célula, [cor no tema claro, cor no tema escuro].
// No escuro as mesmas famílias partem do fundo do tema e clareiam com o valor.
const both = (palette, t) => [ramp(palette[0], t), ramp(palette[1], t)];

function climateColors(mesh) {
  const rand = rng(31);
  const warm = [
    ['#fdf7e0', '#fbf0cb', '#f8e8b4', '#f5dfa0', '#f2d68e', '#f0cd80'],
    ['#525a3d', '#63603a', '#756636', '#886d32', '#9a742f', '#aa7a2d'],
  ];
  const hot = [
    ['#f3d3a8', '#f0c69c', '#edb991'],
    ['#8f5b30', '#96522f', '#9c4a33'],
  ];
  const mild = [
    ['#eef2e2', '#e8f0df', '#e1edda'],
    ['#3d5b4c', '#426656', '#487261'],
  ];
  const wet = [
    ['#deecea', '#d8e9e7', '#d0e4e4'],
    ['#2c5a63', '#27626f', '#2a6c7e'],
  ];
  return mesh.sites.map((p) => {
    const j = (rand() - 0.5) * 0.18;
    const heat = blob(p, [1130, 370, 170]) + 0.55 * blob(p, [1010, 600, 70]);
    const wetZone = blob(p, [540, 1150, 130]) + 0.6 * blob(p, [600, 1330, 100]);
    const mildZone =
      blob(p, [380, 1040, 210]) + 0.9 * blob(p, [760, 1220, 190]) + 0.5 * blob(p, [230, 880, 120]);
    const sun =
      0.3 +
      0.5 * blob(p, [1220, 760, 260]) +
      0.3 * blob(p, [330, 560, 230]) +
      0.3 * blob(p, [700, 300, 200]);
    if (heat + j > 0.55) return both(hot, heat - 0.4 + j);
    if (wetZone + j > 0.5) return both(wet, wetZone - 0.3 + j);
    if (mildZone + j > 0.5) return both(mild, mildZone - 0.4 + j);
    return both(warm, sun + j);
  });
}

function socioeconomicColors(mesh) {
  const rand = rng(77);
  const jade = [
    ['#EDF7F5', '#DDF0EB', '#CCE9E1', '#B2DDD2', '#95CFC0', '#76BFAD', '#55AD98'],
    ['#24424a', '#28504f', '#2c6059', '#317264', '#37856f', '#3f997c', '#4bae8b'],
  ];
  const green = [
    ['#EAF6ED', '#D9EEDE', '#C7E6CF', '#ABD9B6', '#8BCB99'],
    ['#2a4640', '#305845', '#376b4b', '#3f7f53', '#49945d'],
  ];
  const blue = [
    ['#EEF3FB', '#DFE9F8', '#D0DFF6', '#B8D0F0', '#9EBFE9'],
    ['#263f55', '#2a4a6b', '#305782', '#386599', '#4374b0'],
  ];
  const [fx, fy] = FOCUS.socioeconomic;
  return mesh.sites.map((p) => {
    const j = (rand() - 0.5) * 0.16;
    const dense = blob(p, [fx + 10, fy, 180]) + 0.8 * blob(p, [1128, 480, 170]);
    const mid = 0.26 + 0.18 * blob(p, [960, 860, 240]) + 0.14 * blob(p, [330, 300, 200]);
    const blueZone = blob(p, [720, 1230, 170]) + 0.5 * blob(p, [560, 1350, 120]);
    const greenZone =
      blob(p, [1130, 1080, 190]) + 0.8 * blob(p, [300, 1010, 170]) + 0.5 * blob(p, [1250, 760, 130]);
    if (blueZone + j > 0.52) return both(blue, 0.12 + blueZone * 0.42 + j);
    if (greenZone + j > 0.5) return both(green, 0.18 + greenZone * 0.45 + j);
    return both(jade, mid + dense * 0.5 + j);
  });
}

const PARTIES = {
  blue: '#3267ae',
  red: '#cf4b56',
  green: '#238b74',
  amber: '#dc9742',
  violet: '#885eb2',
};
// Fundo do mosaico no tema escuro, como o --map-land do mapa.
const LAND = '#1f3138';

function politicalColors(mesh) {
  const rand = rng(909);
  // Cada território fica com a cor da semente mais próxima: blocos contíguos,
  // como num mapa de resultado. Sem nomes: a arte não sugere resultado real.
  const seeds = [
    [566, 1004, 'blue'], [420, 1160, 'blue'], [700, 1170, 'blue'], [360, 880, 'blue'],
    [420, 480, 'red'], [640, 320, 'red'], [300, 650, 'red'], [690, 620, 'red'],
    [1130, 1080, 'green'], [1260, 880, 'green'], [980, 1260, 'green'],
    [1140, 300, 'amber'], [1320, 440, 'amber'], [960, 480, 'amber'],
    [860, 840, 'violet'], [1020, 700, 'violet'],
  ];
  return mesh.sites.map((p) => {
    const order = seeds.map((s) => dist(p, s)).sort((a, b) => a - b);
    const party = PARTIES[seeds.reduce((best, s) => (dist(p, s) < dist(p, best) ? s : best))[2]];
    // A margem cresce longe da divisa entre blocos; os disputados ficam mais claros.
    const margin = clamp((order[1] - order[0]) / 260);
    const tint = 0.2 + 0.24 * margin + (rand() - 0.5) * 0.12;
    return [mix('#ffffff', party, tint), mix(LAND, party, tint * 1.75)];
  });
}

// -------------------------------------------------------------- traçados --
// [d, tipo, atraso (ms), duração (ms)], contados a partir da entrada da cena.

function climateLines() {
  const main = [[150, 636], [300, 618], [440, 570], [540, 580], [640, 628], [722, 648], [806, 620], [900, 586], [1004, 574], [1100, 540], [1180, 494], [1262, 482], [1420, 500]];
  const tributaries = [
    [[905, 250], [852, 338], [862, 420], [886, 500], [842, 558], [832, 606]],
    [[1192, 380], [1184, 450], [1172, 496]],
    [[1022, 572], [1044, 648], [1030, 722], [1082, 800], [1150, 880], [1152, 960], [1190, 1040]],
    [[576, 598], [530, 650], [542, 722], [520, 790], [452, 870], [430, 976]],
    [[386, 586], [402, 652], [442, 742], [502, 800], [522, 862], [500, 960], [542, 1042], [600, 1160], [650, 1240], [662, 1400]],
    [[300, 440], [262, 520], [286, 590], [296, 616]],
  ];
  return [
    [curve(main, 0.8), 'main', 0, 1500],
    ...tributaries.map((points, i) => [curve(points, 1), 'minor', 260 + i * 130, 1000]),
  ];
}

// As rodovias partem da sede em foco e crescem para fora, na velocidade da onda.
function socioeconomicLines() {
  const focus = FOCUS.socioeconomic;
  const speed = 0.8;
  const roads = [
    ['main', [focus, [748, 640], [950, 560], [1128, 480], [1290, 430], [1440, 410]]],
    ['main', [focus, [430, 640], [330, 668], [200, 700], [80, 716]]],
    ['minor', [focus, [520, 470], [560, 330], [530, 200], [550, 130]]],
    ['minor', [focus, [500, 760], [420, 900], [380, 1080], [300, 1260]]],
    ['minor', [[748, 640], [800, 800], [900, 950], [940, 1120], [1040, 1300], [1060, 1420]]],
    ['minor', [[1128, 480], [1090, 340], [1150, 200], [1180, 130]]],
    ['minor', [[1128, 480], [1230, 620], [1260, 800], [1340, 960]]],
    ['minor', [[900, 950], [1050, 1010], [1200, 1100]]],
  ];
  const lines = roads.map(([kind, points]) => [
    curve(points, 0.5),
    kind,
    Math.round(dist(points[0], focus) / speed),
    Math.round(pathLength(points) / speed),
  ]);
  const towns = [
    [748, 640, 10], [1128, 480, 13], [950, 560, 7], [330, 668, 8], [520, 470, 7], [560, 330, 7],
    [420, 900, 8], [900, 950, 9], [1230, 620, 7], [940, 1120, 6], [1090, 340, 7], [1050, 1010, 6],
  ].map(([x, y, r]) => [x, y, r, Math.round(dist([x, y], focus) / speed)]);
  return { lines, towns };
}

// Divisas de UF: acompanham as arestas da malha e se abrem a partir do foco.
function politicalLines(mesh, reach) {
  const states = [[420, 430], [1080, 380], [340, 1000], [820, 880], [1240, 930], [780, 1340]];
  const stateOf = mesh.sites.map((s) =>
    states.reduce((best, seed, i) => (dist(s, seed) < dist(s, states[best]) ? i : best), 0),
  );
  const focus = FOCUS.political;
  return chain(edges(mesh, (i, j) => i < j && stateOf[i] !== stateOf[j])).map((points) => {
    const outward = dist(points[0], focus) <= dist(points.at(-1), focus) ? points : points.reverse();
    return [
      polyline(outward),
      'main',
      Math.round((dist(outward[0], focus) / reach) * 900),
      Math.round(clamp(pathLength(outward) * 1.4, 350, 1100)),
    ];
  });
}

// ---------------------------------------------------------------- saída --
const mesh = buildMesh(20264);
const colors = {
  climate: climateColors(mesh),
  socioeconomic: socioeconomicColors(mesh),
  political: politicalColors(mesh),
};
const kept = mesh.cells.map((_, i) => i).filter((i) => mesh.keep[i]);
const reach = Object.fromEntries(
  CONTEXTS.map((context) => [
    context,
    Math.ceil(RADIUS + dist(FOCUS[context], CENTER) * (1 + PAN)),
  ]),
);
const jitter = rng(5);

const cells = kept.map((i) => [
  polyline(mesh.cells[i].map((p) => p.v), true),
  ...CONTEXTS.map((context) => colors[context][i][0]),
  ...CONTEXTS.map((context) => colors[context][i][1]),
  // A onda parte do foco do contexto que entra.
  ...CONTEXTS.map((context) =>
    Math.round((dist(mesh.sites[i], FOCUS[context]) / reach[context]) * 1000 + jitter() * 90),
  ),
]);

function selection(context) {
  const focus = FOCUS[context];
  const near = (a, b) => dist(mesh.sites[a], focus) - dist(mesh.sites[b], focus);
  const chosen = [mesh.sites.map((_, i) => i).sort(near)[0]];
  while (chosen.length < 3) {
    const neighbors = new Set(
      chosen.flatMap((i) => mesh.cells[i].map((p) => p.tag)).filter((t) => t >= 0 && !chosen.includes(t)),
    );
    chosen.push([...neighbors].sort(near)[0]);
  }
  const inside = new Set(chosen);
  const outline = chain(edges(mesh, (i, j) => inside.has(i) && !inside.has(j)));
  if (outline.length !== 1) throw new Error(`Seleção de ${context} não fechou um único contorno.`);
  return {
    outline: polyline(outline[0].slice(0, -1), true),
    inner: edges(mesh, (i, j) => inside.has(i) && inside.has(j) && i < j)
      .map((segment) => polyline(segment))
      .join(''),
  };
}

const roads = socioeconomicLines();
const scenes = Object.fromEntries(
  CONTEXTS.map((context) => [
    context,
    {
      focus: FOCUS[context],
      pan: [
        Math.round((CENTER[0] - FOCUS[context][0]) * PAN),
        Math.round((CENTER[1] - FOCUS[context][1]) * PAN),
      ],
      ...selection(context),
      lines: {
        climate: climateLines,
        socioeconomic: () => roads.lines,
        political: () => politicalLines(mesh, reach.political),
      }[context](),
      towns: context === 'socioeconomic' ? roads.towns : [],
    },
  ]),
);

const view = [CENTER[0] - RADIUS - MARGIN, CENTER[1] - RADIUS - MARGIN, 2 * (RADIUS + MARGIN)];
const rows = (items) => items.map((item) => `  ${JSON.stringify(item)},`).join('\n');

const source = `// Gerado por scripts/generate-auth-lens.mjs. Não edite à mão: ajuste o script e gere de novo.

export type LensContext = 'climate' | 'socioeconomic' | 'political';

/**
 * Contorno e, na ordem de LensContext: três cores do tema claro, três do tema
 * escuro e três atrasos de onda (ms).
 */
// prettier-ignore
export type LensCell = readonly [
  string,
  string, string, string,
  string, string, string,
  number, number, number,
];
/** Traçado, tipo, atraso (ms) e duração (ms) do desenho. */
export type LensLine = readonly [string, 'main' | 'minor', number, number];
/** x, y, raio e atraso (ms). */
export type LensTown = readonly [number, number, number, number];

export interface LensScene {
  focus: readonly [number, number];
  /** Deslocamento do mapa que aproxima o foco do centro da lente. */
  pan: readonly [number, number];
  outline: string;
  inner: string;
  lines: readonly LensLine[];
  towns: readonly LensTown[];
}

/** Canto superior esquerdo e lado do quadrado de mapa, em pixels da arte. */
export const LENS_VIEW = ${JSON.stringify(view)} as const;

// prettier-ignore
export const LENS_CELLS: readonly LensCell[] = [
${rows(cells)}
];

// prettier-ignore
export const LENS_SCENES: Record<LensContext, LensScene> = {
${CONTEXTS.map((context) => `  ${context}: ${JSON.stringify(scenes[context])},`).join('\n')}
};
`;

const target = fileURLToPath(new URL('../src/features/auth/authLensArt.ts', import.meta.url));
writeFileSync(target, source);
console.log(`${cells.length} células, ${Math.round(source.length / 1024)} KB → ${target}`);
