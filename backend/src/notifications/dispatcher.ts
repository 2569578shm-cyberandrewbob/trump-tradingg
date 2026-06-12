import { query } from '../db/pool.js';
import { riskRank, type RiskLevel } from '../lib/types.js';
import { sendPush } from './fcm.js';

interface AlertRow {
  id: string;
  risk_level: RiskLevel;
  categories: string[];
  notification_title: string;
  notification_body: string;
  summary: string;
  confirmed: boolean;
  source_url: string;
  detected_at: Date;
  tickers: string[];
}

interface RecipientRow {
  user_id: string;
  fcm_tokens: string[];
  min_risk_level: RiskLevel;
  categories: string[];
  tickers_only: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string;
  watch_tickers: string[];
}

export function inQuietHours(start: number | null, end: number | null, tz: string, now = new Date()): boolean {
  if (start === null || end === null) return false;
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(now),
  ) % 24;
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function matchesWatchlist(alertTickers: string[], watchTickers: string[]): string[] {
  const watch = new Set(watchTickers.map((t) => t.toUpperCase()));
  return alertTickers.filter((t) => watch.has(t.toUpperCase()));
}

/** Decide whether a user should receive this alert and how. */
export function shouldNotify(alert: AlertRow, user: RecipientRow): { send: boolean; reason: string; personalized: boolean } {
  const matched = matchesWatchlist(alert.tickers, user.watch_tickers);
  const personalized = matched.length > 0;

  if (riskRank(alert.risk_level) < riskRank(user.min_risk_level) && !personalized) {
    return { send: false, reason: 'suppressed_prefs', personalized };
  }
  if (user.categories.length > 0 && !alert.categories.some((c) => user.categories.includes(c)) && !personalized) {
    return { send: false, reason: 'suppressed_prefs', personalized };
  }
  if (user.tickers_only && !personalized) {
    return { send: false, reason: 'suppressed_prefs', personalized };
  }
  // Critical alerts and watchlist hits break through quiet hours; everything else respects them.
  if (alert.risk_level !== 'Critical' && !personalized &&
      inQuietHours(user.quiet_hours_start, user.quiet_hours_end, user.timezone)) {
    return { send: false, reason: 'suppressed_quiet_hours', personalized };
  }
  return { send: true, reason: 'sent', personalized };
}

export async function dispatchAlert(alertId: string): Promise<void> {
  const [alert] = await query<AlertRow>(
    `SELECT a.id, a.risk_level, a.categories, a.notification_title, a.notification_body, a.summary,
            a.confirmed, rs.source_url, rs.detected_at,
            COALESCE(array_agg(at.ticker) FILTER (WHERE at.ticker IS NOT NULL), '{}') AS tickers
     FROM processed_alerts a
     JOIN raw_statements rs ON rs.id = a.raw_statement_id
     LEFT JOIN alert_tickers at ON at.alert_id = a.id
     WHERE a.id = $1
     GROUP BY a.id, rs.source_url, rs.detected_at`,
    [alertId],
  );
  if (!alert) return;

  const recipients = await query<RecipientRow>(
    `SELECT u.id AS user_id, u.fcm_tokens,
            COALESCE(p.min_risk_level, 'High') AS min_risk_level,
            COALESCE(p.categories, '{}') AS categories,
            COALESCE(p.tickers_only, FALSE) AS tickers_only,
            p.quiet_hours_start, p.quiet_hours_end,
            COALESCE(p.timezone, 'UTC') AS timezone,
            COALESCE(array_agg(w.ticker) FILTER (WHERE w.ticker IS NOT NULL), '{}') AS watch_tickers
     FROM users u
     LEFT JOIN notification_preferences p ON p.user_id = u.id
     LEFT JOIN watchlists w ON w.user_id = u.id
     WHERE cardinality(u.fcm_tokens) > 0
     GROUP BY u.id, p.min_risk_level, p.categories, p.tickers_only,
              p.quiet_hours_start, p.quiet_hours_end, p.timezone`,
  );

  for (const user of recipients) {
    const decision = shouldNotify(alert, user);
    if (!decision.send) {
      await query(
        `INSERT INTO notification_logs (alert_id, user_id, personalized, status) VALUES ($1,$2,$3,$4)`,
        [alert.id, user.user_id, decision.personalized, decision.reason],
      );
      continue;
    }

    const matched = matchesWatchlist(alert.tickers, user.watch_tickers);
    const title = decision.personalized
      ? `⚠ WATCHLIST ${matched.join(', ')} — ${alert.notification_title}`
      : alert.notification_title;

    try {
      const dead = await sendPush(user.fcm_tokens, {
        title,
        body: alert.notification_body,
        data: {
          alertId: alert.id,
          riskLevel: alert.risk_level,
          categories: alert.categories.join(','),
          tickers: alert.tickers.join(','),
          sourceUrl: alert.source_url,
          detectedAt: alert.detected_at.toISOString(),
          confirmed: String(alert.confirmed),
        },
      });
      if (dead.length) {
        await query(`UPDATE users SET fcm_tokens = array(SELECT t FROM unnest(fcm_tokens) t WHERE NOT (t = ANY($2))) WHERE id = $1`,
          [user.user_id, dead]);
      }
      await query(
        `INSERT INTO notification_logs (alert_id, user_id, personalized, status) VALUES ($1,$2,$3,'sent')`,
        [alert.id, user.user_id, decision.personalized],
      );
    } catch (err) {
      await query(
        `INSERT INTO notification_logs (alert_id, user_id, personalized, status, error) VALUES ($1,$2,$3,'failed',$4)`,
        [alert.id, user.user_id, decision.personalized, (err as Error).message],
      );
    }
  }
}
