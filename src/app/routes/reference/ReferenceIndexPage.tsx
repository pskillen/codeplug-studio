import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FirmwareRadioId } from '@core/firmware/types.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { toolsStripItems, type ContextualStripItem } from '../../nav/contextualStripItems.ts';
import { openExternalUrl } from '../../lib/openExternalUrl.ts';
import { listOfferedFirmwareUpdaters } from '../../services/firmwareFlashEnvGate.ts';
import {
  BandPlanArt,
  FirmwareArt,
  MaidenheadArt,
  PropagationArt,
  TrackingArt,
} from './ToolArt.tsx';
import classes from './ReferenceIndexPage.module.css';

interface ToolCardMeta {
  description: string;
  Art: ComponentType;
  /** Shows a NEW badge, goes first and spans two columns. */
  featured?: boolean;
}

/** Card copy and artwork per Tools strip destination; the strip decides which tools are offered. */
const TOOL_CARDS: Record<string, ToolCardMeta> = {
  '/firmware': {
    description: 'Install MM9PDY firmware on your radio, or put the stock firmware back.',
    Art: FirmwareArt,
    featured: true,
  },
  '/reference/maidenhead': {
    description: 'Turn a grid square into a position and back, with a map.',
    Art: MaidenheadArt,
  },
  '/reference/bands': {
    description: 'UK amateur band plan: who uses which part of each band.',
    Art: BandPlanArt,
  },
  '/tracking': {
    description: 'Satellite passes and live positions for your location.',
    Art: TrackingArt,
  },
  'https://propagation.mm9pdy.net/': {
    description: 'See how HF signals bounce off the ionosphere.',
    Art: PropagationArt,
  },
};

const FIRMWARE_RADIO_SHORT_NAMES: Record<FirmwareRadioId, string> = {
  'retevis-rt95-head': 'RT95',
  'anytone-at-d890uv': 'AT-D890UV',
  'baofeng-dm32uv': 'DM-32UV',
};

function badgesFor(item: ContextualStripItem): string[] {
  if (item.to === '/firmware') {
    return [
      ...listOfferedFirmwareUpdaters().map((d) => FIRMWARE_RADIO_SHORT_NAMES[d.radioId]),
      'Desktop Chrome / Edge',
    ];
  }
  return item.external ? ['Opens in a new tab ↗'] : [];
}

const isFeatured = (item: ContextualStripItem) => TOOL_CARDS[item.to]?.featured === true;

/** Tools landing page: one card per Tools strip destination, featured tools first. */
export default function ReferenceIndexPage() {
  const navigate = useNavigate();
  const known = toolsStripItems.filter((item) => TOOL_CARDS[item.to]);
  const cards = [...known.filter(isFeatured), ...known.filter((item) => !isFeatured(item))];

  function open(item: ContextualStripItem) {
    if (item.external) {
      void openExternalUrl(item.to);
      return;
    }
    navigate(item.to);
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Tools</h1>
        <p className={classes.description}>
          Helpers for programming and using your radio. Pick one to open it.
        </p>
        <div className={classes.grid}>
          {cards.map((item) => {
            const { description, Art, featured } = TOOL_CARDS[item.to];
            const badges = badgesFor(item);
            return (
              <button
                key={item.to}
                type="button"
                className={[classes.card, featured ? classes.featured : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => open(item)}
              >
                <span className={classes.art}>
                  <Art />
                </span>
                <span className={classes.body}>
                  <span className={classes.cardTitle}>
                    {item.label}
                    {featured ? <span className={classes.new}>NEW</span> : null}
                  </span>
                  <span className={classes.cardDescription}>{description}</span>
                  {badges.length > 0 ? (
                    <span className={classes.badges}>
                      {badges.map((badge) => (
                        <span key={badge} className={classes.badge}>
                          {badge}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </DesignSystemV2Provider>
  );
}
