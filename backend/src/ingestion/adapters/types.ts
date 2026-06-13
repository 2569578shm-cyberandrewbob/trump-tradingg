import type { IncomingStatement, SourceType } from '../../lib/types.js';

/** Result of one poll, carrying health telemetry alongside the statements. */
export interface FetchOutcome {
  items: IncomingStatement[];
  /** Last HTTP status observed (null if not an HTTP fetch). */
  httpStatus: number | null;
  /** Raw items seen from the source before dedupe/empty filtering. */
  fetchedCount: number;
  /** Optional human-readable note (e.g. "media-only posts skipped: 3"). */
  note?: string;
}

/** Thrown by adapters on a failed fetch so the worker can record the exact reason. */
export class FetchError extends Error {
  constructor(message: string, readonly httpStatus: number | null, readonly body?: string) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface SourceAdapter {
  /** Must match sources.key in the database. */
  readonly key: string;
  readonly type: SourceType;
  /** True if this adapter is inert without an API key (never silently skipped — surfaced in /sources). */
  readonly requiresKey?: boolean;
  /** Fetch statements published after `since`. Must only use legal/official access. */
  fetchLatest(since: Date): Promise<FetchOutcome>;
}

export type { IncomingStatement, SourceType };
