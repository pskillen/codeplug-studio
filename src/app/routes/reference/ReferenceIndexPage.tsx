import type { ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { FirmwareRadioId } from '@core/firmware/types.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import {
  DEBUG_SECTION_ICON,
  DEBUG_TOOL_LINKS,
  resolveToolsStripItems,
  type ContextualStripItem,
} from '../../nav/contextualStripItems.ts';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { openExternalUrl } from '../../lib/openExternalUrl.ts';
import { listOfferedFirmwareUpdaters } from '../../services/firmwareFlashEnvGate.ts';
import { resolveDebugPagesGate } from '../../services/prodFeatureGate.ts';
import {
  BandPlanArt,
  BearingArt,
  FirmwareArt,
  MaidenheadArt,
  NearbyArt,
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
  '/tools/locator': {
    description: 'Your Maidenhead locator from GPS, ready to copy or share. Look up any place too.',
    Art: MaidenheadArt,
  },
  '/tools/bearing': {
    description: 'Drop two pins for the distance, the bearing and the return bearing.',
    Art: BearingArt,
  },
  '/tools/nearby': {
    description: 'Repeaters around a point, nearest first, with distance and bearing.',
    Art: NearbyArt,
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
  'retevis-rt95-main': 'RT95 main board',
  'anytone-at-d890uv': 'AT-D890UV',
  'baofeng-dm32uv': 'DM-32UV',
  'baofeng-uv5rmini': 'UV-5R Mini',
};

/** Badge for tools that need Web Serial, which only desktop Chrome and Edge have. */
const WEB_SERIAL_BADGE = 'Desktop Chrome / Edge';

function badgesFor(item: ContextualStripItem, developerMode: boolean): string[] {
  if (item.to === '/firmware') {
    return [
      ...listOfferedFirmwareUpdaters(undefined, developerMode).map(
        (d) => FIRMWARE_RADIO_SHORT_NAMES[d.radioId],
      ),
      WEB_SERIAL_BADGE,
    ];
  }
  return item.external ? ['Opens in a new tab ↗'] : [];
}

/**
 * The flasher card's "which radios exactly" lines (#1670): each offered radio's own `supportedRadios` text, so an owner
 * can check before opening the flasher. Radios without the field show nothing.
 */
function supportLinesFor(item: ContextualStripItem, developerMode: boolean): string[] {
  if (item.to !== '/firmware') return [];
  return listOfferedFirmwareUpdaters(undefined, developerMode).flatMap((d) =>
    d.stock.supportedRadios
      ? [`${FIRMWARE_RADIO_SHORT_NAMES[d.radioId]} supported: ${d.stock.supportedRadios}`]
      : [],
  );
}

const isFeatured = (item: ContextualStripItem) => TOOL_CARDS[item.to]?.featured === true;

/**
 * The Debug section (#1673): the Debug index and each Debug page, so they can be reached without a URL bar (the
 * Android app has none). The caller shows it only where the Debug pages gate allows them.
 */
function DebugToolsSection() {
  return (
    <section className={classes.debug} aria-labelledby="tools-debug-heading">
      <h2 id="tools-debug-heading" className={classes.sectionTitle}>
        <DEBUG_SECTION_ICON size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />
        Debug
      </h2>
      <p className={classes.description}>
        Contributor tools for browser storage and radio diagnostics. The production site hides them
        unless developer mode is on.
      </p>
      <ul className={classes.debugLinks}>
        {DEBUG_TOOL_LINKS.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className={classes.debugLink}>
              <span className={classes.debugLinkLabel}>{link.label}</span>
              {link.webSerialOnly ? (
                <span className={classes.badge}>{WEB_SERIAL_BADGE}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tools landing page: one card per Tools strip destination, featured tools first. */
export default function ReferenceIndexPage() {
  const navigate = useNavigate();
  const [developerMode] = useDeveloperMode();
  const debugAllowed = resolveDebugPagesGate({ developerMode }) === 'allowed';
  const known = resolveToolsStripItems(developerMode).filter((item) => TOOL_CARDS[item.to]);
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
            const badges = badgesFor(item, developerMode);
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
                  {supportLinesFor(item, developerMode).map((line) => (
                    <span key={line} className={classes.cardDescription}>
                      {line}
                    </span>
                  ))}
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
        {debugAllowed ? <DebugToolsSection /> : null}
      </div>
    </DesignSystemV2Provider>
  );
}
