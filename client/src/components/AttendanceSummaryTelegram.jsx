import { toneStyle } from "../utils/attendanceTelegram";

import styles from "./AttendanceSummaryTelegram.module.scss";

const SIZE = 96;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEGMENT_GAP = 3;

// Кольцо-разбивка: каждый сегмент — доля своего статуса, в центре — главный процент.
const Ring = ({ segments, centerValue, centerLabel }) => {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const visible = segments.filter((seg) => seg.value > 0).length;
  const gap = visible > 1 ? SEGMENT_GAP : 0;

  let offset = 0;

  return (
    <div className={styles.ring}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            className={styles.ringTrack}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE}
          />
          {total > 0 &&
            segments.map((seg) => {
              if (!seg.value) return null;

              const length = (seg.value / total) * CIRCUMFERENCE;
              const drawn = Math.max(0, length - gap);
              const start = offset;
              offset += length;

              return (
                <circle
                  key={seg.tone}
                  className={styles.ringSegment}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  strokeWidth={STROKE}
                  style={{
                    ...toneStyle(seg.tone),
                    strokeDasharray: `${drawn} ${CIRCUMFERENCE - drawn}`,
                    strokeDashoffset: -start,
                  }}
                />
              );
            })}
        </g>
      </svg>

      <div className={styles.ringCenter}>
        <b>{centerValue}</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
};

const Tile = ({ tile, active, onToggle }) => {
  const content = (
    <>
      <span className={styles.tileTop}>
        <span className={styles.tileIcon}>{tile.icon}</span>
        {tile.sub && <span className={styles.tileSub}>{tile.sub}</span>}
      </span>

      <span className={styles.tileValue}>{tile.value}</span>
      <span className={styles.tileLabel}>{tile.label}</span>

      {tile.progress != null && (
        <span className={styles.tileTrack}>
          <span
            className={styles.tileFill}
            style={{ width: `${Math.min(100, Math.max(0, tile.progress))}%` }}
          />
        </span>
      )}
    </>
  );

  if (!tile.filterable) {
    return (
      <div className={styles.tile} style={toneStyle(tile.tone)}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.tile} ${styles.tileButton} ${active ? styles.tileActive : ""}`}
      style={toneStyle(tile.tone)}
      aria-pressed={active}
      onClick={() => onToggle(tile.key)}
    >
      {content}
    </button>
  );
};

// Сводка страницы: кольцо явки и полоса плиток. Плитки статусов ещё и фильтры списка.
const AttendanceSummaryTelegram = ({
  hero,
  tiles = [],
  activeKeys,
  onToggle,
  loading = false,
}) => {
  if (loading) {
    return (
      <>
        <div className={`${styles.hero} ${styles.skeleton}`}>
          <span className={`${styles.skBlock} ${styles.skRing}`} />
          <div className={styles.heroBody}>
            <span className={styles.skBlock} style={{ width: "45%", height: 12 }} />
            <span className={styles.skBlock} style={{ width: "70%", height: 32 }} />
            <span className={styles.skBlock} style={{ width: "85%", height: 12 }} />
          </div>
        </div>

        <div className={styles.tiles}>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`${styles.skBlock} ${styles.skTile}`} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <section className={styles.hero}>
        <Ring
          segments={hero.segments}
          centerValue={hero.rate == null ? "—" : `${hero.rate}%`}
          centerLabel={hero.rateLabel}
        />

        <div className={styles.heroBody}>
          <span className={styles.heroCaption}>{hero.caption}</span>

          <div className={styles.heroValue}>
            <b>{hero.value}</b>
            <span>/ {hero.of}</span>
          </div>

          {hero.note && <span className={styles.heroNote}>{hero.note}</span>}

          <ul className={styles.legend}>
            {hero.legend.map((item) => (
              <li key={item.tone} style={toneStyle(item.tone)}>
                <i />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <Tile
            key={tile.key}
            tile={tile}
            active={activeKeys?.has(tile.key)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </>
  );
};

export default AttendanceSummaryTelegram;
