import { toneStyle } from "../utils/attendanceTelegram";
import { IconAlarm, IconCheck } from "./tg/tgIcons";

import tileStyles from "./AttendanceSummaryTelegram.module.scss";
import styles from "./LateSummaryTelegram.module.scss";

const Tile = ({ tile }) => (
  <div className={tileStyles.tile} style={toneStyle(tile.tone)}>
    <span className={tileStyles.tileTop}>
      <span className={tileStyles.tileIcon}>{tile.icon}</span>
      {tile.sub && <span className={tileStyles.tileSub}>{tile.sub}</span>}
    </span>

    <span className={tileStyles.tileValue}>{tile.value}</span>
    <span className={tileStyles.tileLabel}>{tile.label}</span>

    {tile.progress != null && (
      <span className={tileStyles.tileTrack}>
        <span
          className={tileStyles.tileFill}
          style={{ width: `${Math.min(100, Math.max(0, tile.progress))}%` }}
        />
      </span>
    )}
  </div>
);

// Сводка «Опоздания»: сколько человек опоздало, полоса тяжести (она же фильтр) и плитки итогов.
const LateSummaryTelegram = ({
  loading = false,
  caption,
  people,
  unit,
  severity = [],
  activeKeys,
  onToggle,
  tiles = [],
}) => {
  if (loading) {
    return (
      <>
        <div className={`${styles.hero} ${styles.skeleton}`}>
          <div className={styles.heroTop}>
            <span className={`${tileStyles.skBlock} ${styles.skIcon}`} />
            <div className={styles.heroBody}>
              <span className={tileStyles.skBlock} style={{ width: "50%", height: 12 }} />
              <span className={tileStyles.skBlock} style={{ width: "36%", height: 34 }} />
            </div>
          </div>
          <span className={tileStyles.skBlock} style={{ height: 8 }} />
        </div>

        <div className={tileStyles.tiles}>
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className={`${tileStyles.skBlock} ${tileStyles.skTile}`} />
          ))}
        </div>
      </>
    );
  }

  const hasPeople = people > 0;
  const visible = severity.filter((item) => item.value > 0);

  return (
    <>
      <section className={`${styles.hero} ${hasPeople ? "" : styles.heroClear}`}>
        <div className={styles.heroTop}>
          <span className={styles.heroIcon}>{hasPeople ? <IconAlarm /> : <IconCheck />}</span>

          <div className={styles.heroBody}>
            <span className={styles.heroCaption}>{caption}</span>
            <div className={styles.heroValue}>
              <b>{people}</b>
              <span>{unit}</span>
            </div>
          </div>
        </div>

        {hasPeople && (
          <>
            <span className={styles.bar} aria-hidden="true">
              {visible.map((item) => (
                <span
                  key={item.key}
                  className={styles.barSegment}
                  style={{ ...toneStyle(item.tone), flexGrow: item.value }}
                />
              ))}
            </span>

            <ul className={styles.legend}>
              {visible.map((item) => {
                const active = activeKeys?.has(item.key);

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`${styles.legendBtn} ${active ? styles.legendActive : ""}`}
                      style={toneStyle(item.tone)}
                      aria-pressed={Boolean(active)}
                      onClick={() => onToggle(item.key)}
                    >
                      <i />
                      <span>{item.label}</span>
                      <b>{item.value}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {hasPeople && tiles.length > 0 && (
        <div className={tileStyles.tiles}>
          {tiles.map((tile) => (
            <Tile key={tile.key} tile={tile} />
          ))}
        </div>
      )}
    </>
  );
};

export default LateSummaryTelegram;
