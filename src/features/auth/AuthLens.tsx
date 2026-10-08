import { Fragment, memo, useState, type CSSProperties, type ReactNode } from 'react';
import { LENS_CELLS, LENS_SCENES, LENS_VIEW, type LensContext } from './authLensArt';

interface Chip {
  x: number;
  y: number;
  /** Ponto na cor do contexto, ponto na cor do indicador ou barra dos dois líderes. */
  lead: 'accent' | 'tone' | 'split';
  value: string;
  unit?: string;
}

interface Scene {
  id: LensContext;
  label: string;
  icon: ReactNode;
  chips: [Chip, Chip];
  /** `anchor` é o ponto da borda do cartão onde chega a linha que sai do território. */
  card: {
    x: number;
    y: number;
    anchor: [number, number];
    title: string;
    status: string;
    source: string;
    bar?: boolean;
  };
}

const iconProps = {
  viewBox: '0 0 44 44',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

// Posições em pixels da arte (1540 × 1568). Valores ilustrativos: a arte é
// decorativa e não representa leituras atuais.
const SCENES: Scene[] = [
  {
    id: 'climate',
    label: 'Clima',
    icon: (
      <svg {...iconProps}>
        <path d="M12 35h20a9.500 9.500 0 0 0 1.500-18.900A12.500 12.500 0 0 0 9.500 19 8 8 0 0 0 12 35z" />
      </svg>
    ),
    chips: [
      { x: 232, y: 372, lead: 'accent', value: '29°' },
      { x: 296, y: 1146, lead: 'tone', value: '7,7 mm' },
    ],
    card: {
      x: 924,
      y: 884,
      anchor: [1012, 884],
      title: 'Risco hidrológico',
      status: 'Moderado',
      source: 'CEMADEN',
    },
  },
  {
    id: 'socioeconomic',
    label: 'Socioeconômico',
    icon: (
      <svg {...iconProps}>
        <circle cx="16" cy="13" r="7" />
        <path d="M3 39c0-8.500 5.600-13 13-13s13 4.500 13 13" />
        <circle cx="33" cy="12" r="5.500" />
        <path d="M34 24c5 .5 8 4.500 8 10" />
      </svg>
    ),
    chips: [
      { x: 1016, y: 352, lead: 'accent', value: '48,2 mil', unit: 'hab.' },
      { x: 930, y: 1132, lead: 'tone', value: '84%', unit: 'urbana' },
    ],
    card: {
      x: 56,
      y: 290,
      anchor: [476, 505],
      title: 'PIB per capita',
      status: 'R$ 38,4 mil',
      source: 'IBGE',
    },
  },
  {
    id: 'political',
    label: 'Política',
    icon: (
      <svg {...iconProps}>
        <path d="M11 21V5h22v16" />
        <path d="m17 12 4 4 7-8" />
        <path d="M3 21h38v19H3z" />
      </svg>
    ),
    chips: [
      { x: 236, y: 404, lead: 'tone', value: '79,4%', unit: 'comparecimento' },
      { x: 1044, y: 566, lead: 'split', value: '54,2%' },
    ],
    card: {
      x: 56,
      y: 1090,
      anchor: [504, 1090],
      title: 'Prefeitura',
      status: '2º turno',
      source: 'TSE',
      bar: true,
    },
  },
];

const u = (value: number) => `calc(${value} * var(--u))`;
const vars = (values: Record<string, string | number>) => values as CSSProperties;
const active = (name: string, on: boolean) => (on ? `${name} is-active` : name);

// Linha do território selecionado até o cartão: parte de fora do contorno.
function leader(scene: Scene) {
  const { focus, pan } = LENS_SCENES[scene.id];
  const from = [focus[0] + pan[0], focus[1] + pan[1]] as const;
  const [dx, dy] = [scene.card.anchor[0] - from[0], scene.card.anchor[1] - from[1]];
  const length = Math.hypot(dx, dy);
  const clear = 74;
  return {
    left: u(from[0] + (dx / length) * clear),
    top: u(from[1] + (dy / length) * clear),
    width: u(length - clear),
    ...vars({ '--angle': `${Math.atan2(dy, dx)}rad` }),
  };
}

// O mosaico de um tema: as três cores de cada território e os atrasos da onda.
const mosaic = (dark: boolean) =>
  LENS_CELLS.map(([d, l0, l1, l2, k0, k1, k2, w0, w1, w2], index) => (
    <path
      key={index}
      className="auth-lens-cell"
      d={d}
      style={vars({
        '--c0': dark ? k0 : l0,
        '--c1': dark ? k1 : l1,
        '--c2': dark ? k2 : l2,
        '--w0': w0,
        '--w1': w1,
        '--w2': w2,
      })}
    />
  ));
const lightCells = mosaic(false);
const darkCells = mosaic(true);

export const AuthLens = memo(function AuthLens() {
  // Conta as voltas do satélite: cada volta completa troca o contexto.
  const [turn, setTurn] = useState(0);
  const current = SCENES[turn % SCENES.length]!;
  const [left, top, size] = LENS_VIEW;
  const [panX, panY] = LENS_SCENES[current.id].pan;

  return (
    <div className="auth-lens" data-context={current.id}>
      <div className="auth-lens-stage" style={vars({ '--turn': turn })}>
        <span className="auth-lens-ring" />
        <svg className="auth-lens-dots" viewBox="-640 -640 1280 1280">
          <circle r="632" />
        </svg>
        {/* A volta recomeça a cada troca (key), então satélite e contexto nunca dessincronizam. */}
        <span className="auth-lens-satellite">
          <span key={turn} onAnimationEnd={() => setTurn((value) => value + 1)}>
            <i />
          </span>
        </span>
        <div className="auth-lens-turret">
          {SCENES.map((scene) => (
            <span
              key={scene.id}
              className={active('auth-lens-node', scene === current)}
              data-scene={scene.id}
            >
              <span className="auth-lens-node-body">
                {scene.icon}
                <span
                  className="auth-lens-node-label"
                  style={vars({ '--letters': scene.label.length })}
                >
                  <span>{scene.label}</span>
                </span>
              </span>
            </span>
          ))}
        </div>
        <div className="auth-lens-disc">
          <div className="auth-lens-pan" style={vars({ '--pan-x': panX, '--pan-y': panY })}>
            <svg className="auth-lens-map" viewBox={`${left} ${top} ${size} ${size}`}>
              <defs>
                <radialGradient
                  id="auth-lens-glow"
                  gradientUnits="userSpaceOnUse"
                  cx="690"
                  cy="727"
                  r="430"
                >
                  <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
                  <stop offset="0.55" stopColor="#fff" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g className="auth-lens-cells">{lightCells}</g>
              <g className="auth-lens-cells is-dark">{darkCells}</g>
              <circle
                className="auth-lens-glow"
                cx="760"
                cy="787"
                r="700"
                fill="url(#auth-lens-glow)"
              />
              {SCENES.map((scene) => {
                const art = LENS_SCENES[scene.id];
                return (
                  <g
                    key={scene.id}
                    className={active('auth-lens-layer', scene === current)}
                    data-scene={scene.id}
                  >
                    {art.lines.map(([d, kind, delay, duration], index) => (
                      <Fragment key={index}>
                        <path
                          className={`auth-lens-line is-${kind}`}
                          d={d}
                          pathLength={1}
                          style={vars({ '--delay': delay, '--duration': duration })}
                        />
                        {/* Rodovia principal: um fio claro no meio a distingue de um rio. */}
                        {scene.id === 'socioeconomic' && kind === 'main' && (
                          <path
                            className="auth-lens-line is-core"
                            d={d}
                            pathLength={1}
                            style={vars({ '--delay': delay, '--duration': duration })}
                          />
                        )}
                      </Fragment>
                    ))}
                    {art.towns.map(([cx, cy, r, delay]) => (
                      <circle
                        key={`${cx}-${cy}`}
                        className="auth-lens-town"
                        cx={cx}
                        cy={cy}
                        r={r}
                        style={vars({ '--delay': delay })}
                      />
                    ))}
                    <g className="auth-lens-halo">
                      <circle cx={art.focus[0]} cy={art.focus[1]} r="128" />
                      <circle cx={art.focus[0]} cy={art.focus[1]} r="178" />
                    </g>
                    <path className="auth-lens-selection" d={art.outline} />
                    <path className="auth-lens-selection-inner" d={art.inner} />
                    <path
                      className="auth-lens-line is-outline"
                      d={art.outline}
                      pathLength={1}
                      style={vars({ '--delay': 150, '--duration': 900 })}
                    />
                  </g>
                );
              })}
            </svg>
            {SCENES.map((scene) => {
              const [x, y] = LENS_SCENES[scene.id].focus;
              return (
                <i
                  key={scene.id}
                  className={active('auth-lens-ping', scene === current)}
                  data-scene={scene.id}
                  style={{ left: u(x - 182), top: u(y - 209) }}
                />
              );
            })}
          </div>
        </div>
        <span className="auth-lens-rim" />
        <svg className="auth-lens-ticks" viewBox="0 0 1540 1568">
          <path d="M760 170v62M760 1342v62M141 787h63M1316 787h63" />
        </svg>
        {SCENES.map((scene) => (
          <div
            key={scene.id}
            className={active('auth-lens-scene', scene === current)}
            data-scene={scene.id}
          >
            <span className="auth-lens-leader" style={leader(scene)} />
            {scene.chips.map((chip, index) => (
              <span
                key={chip.value}
                className="auth-lens-chip"
                style={{ left: u(chip.x), top: u(chip.y), ...vars({ '--order': index }) }}
              >
                <span
                  className={
                    chip.lead === 'split' ? 'auth-lens-split' : `auth-lens-dot is-${chip.lead}`
                  }
                />
                {chip.value}
                {chip.unit && <small>{chip.unit}</small>}
              </span>
            ))}
            <div
              className="auth-lens-card"
              style={{
                left: u(scene.card.x),
                top: u(scene.card.y),
                ...vars({
                  '--origin-x': u(scene.card.anchor[0] - scene.card.x),
                  '--origin-y': u(scene.card.anchor[1] - scene.card.y),
                }),
              }}
            >
              <strong>
                <span className="auth-lens-dot" />
                {scene.card.title}
              </strong>
              {scene.card.bar && <span className="auth-lens-bar" />}
              <span className="auth-lens-pill">{scene.card.status}</span>
              <span className="auth-lens-pill is-source">{scene.card.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
