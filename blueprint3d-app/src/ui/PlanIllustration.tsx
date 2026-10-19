import { useEffect, useRef, useState, type PointerEvent } from 'react';

type LayerId = 'all' | 'walls' | 'glass' | 'furniture' | 'dimensions';

const LAYER_META: { id: LayerId; label: string; code: string; note: string }[] = [
  { id: 'all', label: 'All layers', code: 'A-00', note: 'Walls, windows, furniture and drawing guides' },
  { id: 'walls', label: 'Walls', code: 'S-01', note: 'Exterior walls and interior partitions' },
  { id: 'glass', label: 'Windows', code: 'G-02', note: 'Window openings and frames' },
  { id: 'furniture', label: 'Furniture', code: 'I-03', note: 'Interior furniture and spatial arrangement' },
  { id: 'dimensions', label: 'Dimensions', code: 'D-04', note: 'Drawing guides, door swings and dimension lines' },
];

/** Original schematic artwork with interactive layer isolation and spring-damped parallax. */
export function PlanIllustration({ motionPaused = false }: { motionPaused?: boolean }) {
  const [activeLayer, setActiveLayer] = useState<LayerId>('all');
  const artRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ rx: 0, ry: 0 });
  const currentRef = useRef({ rx: 0, ry: 0, vx: 0, vy: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (motionPaused) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      targetRef.current = { rx: 0, ry: 0 };
      currentRef.current = { rx: 0, ry: 0, vx: 0, vy: 0 };
      if (artRef.current) artRef.current.style.transform = '';
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [motionPaused]);

  const stepSpring = () => {
    const cur = currentRef.current;
    const tgt = targetRef.current;
    // Spring physics: stiffness 110, damping 14 (dt ~ 1/60)
    const fx = (tgt.rx - cur.rx) * 0.14;
    const fy = (tgt.ry - cur.ry) * 0.14;
    cur.vx = (cur.vx + fx) * 0.76;
    cur.vy = (cur.vy + fy) * 0.76;
    cur.rx += cur.vx;
    cur.ry += cur.vy;

    if (artRef.current) {
      artRef.current.style.transform = `perspective(1100px) rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg)`;
    }

    const still =
      Math.abs(tgt.rx - cur.rx) < 0.02 &&
      Math.abs(tgt.ry - cur.ry) < 0.02 &&
      Math.abs(cur.vx) < 0.01 &&
      Math.abs(cur.vy) < 0.01;

    if (!still) {
      rafRef.current = requestAnimationFrame(stepSpring);
    } else {
      rafRef.current = null;
      if (tgt.rx === 0 && tgt.ry === 0 && artRef.current) {
        artRef.current.style.transform = '';
      }
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    if (motionPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetRef.current = { rx: -ny * 4.5, ry: nx * 5.5 };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(stepSpring);
    }
  };

  const handlePointerLeave = () => {
    if (motionPaused) return;
    targetRef.current = { rx: 0, ry: 0 };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(stepSpring);
    }
  };

  const activeMeta = LAYER_META.find((l) => l.id === activeLayer) ?? LAYER_META[0];

  return (
    <figure
      className="studio-illustration"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className={`studio-drawing-frame layer-${activeLayer}`}>
        {/* Top architectural sheet index bar */}
        <div className="studio-drawing-index-bar" aria-hidden="true">
          <div className="studio-drawing-stamp">
            <span className="studio-stamp-dot" />
            <span>Drawing study · {activeMeta.code}</span>
          </div>
          <span className="studio-drawing-scale">Illustration · Not to scale</span>
        </div>

        <div ref={artRef} className="studio-illustration-art">
          <svg viewBox="0 0 620 500" role="img" aria-labelledby="space-study-title">
            <title id="space-study-title">An architectural cutaway, drawn in cobalt and vermilion ink</title>
            <defs>
              <pattern
                id="cutaway-hatch"
                patternUnits="userSpaceOnUse"
                width="7"
                height="7"
                patternTransform="rotate(30)"
              >
                <path d="M0 0v7" stroke="#99b3e6" strokeWidth="1.1" />
              </pattern>
              <pattern
                id="iso-grid"
                patternUnits="userSpaceOnUse"
                width="28"
                height="16"
              >
                <path
                  d="M0 8 L14 0 L28 8 L14 16 Z"
                  fill="none"
                  stroke="#1947e5"
                  strokeOpacity="0.08"
                  strokeWidth="0.7"
                />
              </pattern>
              <linearGradient id="slab-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#eef3fb" />
              </linearGradient>
              <linearGradient id="wall-lit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f6f9ff" />
                <stop offset="100%" stopColor="#dce6f7" />
              </linearGradient>
              <linearGradient id="wall-shade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c5d6f2" />
                <stop offset="100%" stopColor="#9eb8e4" />
              </linearGradient>
              <linearGradient id="glass-tint" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ea8ff" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#1947e5" stopOpacity="0.28" />
              </linearGradient>
            </defs>

            <g className="plan-hover">
              {/* Isometric drafting ground datum */}
              <ellipse cx="316" cy="316" rx="268" ry="145" fill="url(#iso-grid)" className="plan-datum-grid" />

              {/* Drop shadow on vellum */}
              <path
                className="plan-shadow"
                d="m65 341 280-160 227 131-281 163Z"
                fill="#dbe3ef"
              />

              <g stroke="#1947e5" strokeWidth="1.25" strokeLinejoin="round">
                {/* Floor Slabs */}
                <g className="plan-floor plan-layer" data-layer="base">
                  <path d="m77 307 270-156 210 122-270 156Z" fill="url(#slab-grad)" />
                  <path d="m77 307 210 122v16L77 323Z" fill="#cad8ef" />
                  <path d="m287 429 270-156v16L287 445Z" fill="#adc3e6" />
                </g>

                {/* Extruded Walls & Partitions */}
                <g className="plan-walls plan-layer" data-layer="walls">
                  <path d="m77 307V192L347 36v115L77 307Z" fill="url(#wall-lit)" />
                  <path d="m77 192 10 6L347 48V36L77 192Z" fill="#fff" />
                  <path d="m347 36 210 122v115L347 151Z" fill="url(#wall-shade)" />
                  <path d="m347 36 210 122-10 6L347 48V36Z" fill="#fff" />
                  <path d="m177 250 170-99 105 61-170 99Z" fill="#edf2fb" />
                  <path d="m177 250V141l10 6v109l-10-6Z" fill="#9bb5e0" />
                  <path d="m187 147 160-93v97l-160 93v-97Z" fill="#f7f9fe" />
                  <path d="m187 147 160-93-10-6-160 93 10 6Z" fill="#fff" />
                  <path d="m347 151 105 61V103L347 42v109Z" fill="#dfe8f7" />
                  <path d="m347 42 105 61-10 6-95-55V42Z" fill="#fff" />
                  <path d="m282 311 170-99v-35l10 6v35l-180 104v-11Z" fill="#9bb5e0" />
                  <path d="m282 311 170-99-10-6-160 93v12Z" fill="#fff" />
                  <path
                    d="m77 307 85 49v-35l10 6v35l65 38v-35l10 6v35l40 23v-47L77 260v47Z"
                    fill="#f3f7fe"
                  />
                  <path d="m287 382 94-54v47l-94 54v-47Z" fill="url(#wall-shade)" />
                  <path d="m430 347 127-74v-47l-127 74v47Z" fill="url(#wall-shade)" />
                  {/* Vermilion door swing arc */}
                  <path d="m381 328 49-28" fill="none" stroke="#d94826" strokeDasharray="4 4" />
                  <path d="m381 375 1-47 35 20" fill="none" stroke="#d94826" strokeWidth="1.5" />
                  <path d="M417 348a40 40 0 0 1-36 27" fill="none" stroke="#d94826" strokeDasharray="3 3" />
                </g>

                {/* Architectural Glazing */}
                <g className="plan-glass plan-layer" data-layer="glass">
                  <path
                    d="m105 215 47-27v57l-47 27v-57Z M192 155l50-29v57l-50 29v-57Z M485 166l45 26v51l-45-26v-51Z"
                    fill="url(#glass-tint)"
                  />
                  <path
                    d="M129 201v57M217 141v56M507 179v51"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                </g>

                {/* Interior Program & Furniture */}
                <g className="plan-furniture plan-layer" data-layer="furniture">
                  <path d="m222 253 52-30 65 37-52 30-65-37Z" fill="#fff" />
                  <path
                    d="m222 253 65 37v14l-65-37v-14Zm65 37 52-30v14l-52 30v-14Z"
                    fill="#d5e1f5"
                  />
                  <path d="m247 239 65 37m-41-51 65 37" fill="none" />
                  <path d="m372 174 36-21 56 32-36 21-56-32Z" fill="#fff" />
                  <path
                    d="m372 174 56 32v10l-56-32v-10Zm56 32 36-21v10l-36 21v-10Z"
                    fill="#d5e1f5"
                  />
                  <ellipse cx="331" cy="344" rx="31" ry="18" fill="#e5eefc" />
                  <path d="m126 289 28-16 31 18-28 16-31-18Z" fill="url(#cutaway-hatch)" />
                </g>

                {/* Datum & Dimension Lines */}
                <g className="plan-dimensions plan-layer" data-layer="dimensions">
                  <path d="m93 339 190 110m15 1 251-145" stroke="#d94826" strokeWidth="1.15" />
                  <path
                    d="m91 334 4 10m185 100 4 10m13-9 5 10m245-155 5 10"
                    stroke="#d94826"
                    strokeWidth="1.3"
                  />
                  {/* Section Cut Callout Nodes */}
                  <g transform="translate(347, 36)">
                    <circle r="4.5" fill="#d94826" stroke="#fff" strokeWidth="1.5" />
                  </g>
                  <g transform="translate(287, 429)">
                    <circle r="4.5" fill="#1947e5" stroke="#fff" strokeWidth="1.5" />
                  </g>
                  {/* Compass / North Indicator on sheet */}
                  <g transform="translate(548, 86)">
                    <circle r="18" fill="#fffdf9" stroke="#1947e5" strokeWidth="1.1" />
                    <path d="M0 -13 L4.5 6 L0 2.5 L-4.5 6 Z" fill="#d94826" stroke="none" />
                    <text
                      y="-22"
                      textAnchor="middle"
                      fill="#142330"
                      fontSize="9"
                      fontWeight="600"
                      letterSpacing="1.2"
                      stroke="none"
                    >
                      N
                    </text>
                  </g>
                </g>

                {/* Animated Drafting Line */}
                <path
                  className="plan-pencil"
                  pathLength="1"
                  d="M77 307V192L347 36l210 122v115L287 429 77 307m100-57V141l160-93 115 55v109L282 311"
                  fill="none"
                  stroke="#d94826"
                  strokeWidth="2"
                />
              </g>
            </g>
          </svg>
        </div>

        {/* Interactive Layer Filter Bar */}
        <div className="studio-layer-pills" role="group" aria-label="Inspect architectural layers">
          {LAYER_META.map((layer) => (
            <button
              key={layer.id}
              type="button"
              aria-pressed={activeLayer === layer.id}
              className={`studio-layer-pill${activeLayer === layer.id ? ' is-active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <span>{layer.label}</span>
            </button>
          ))}
        </div>
      </div>

      <figcaption>
        <span className="studio-drawing-label">{activeMeta.label}</span>
        <span>{activeMeta.note}</span>
      </figcaption>
    </figure>
  );
}
