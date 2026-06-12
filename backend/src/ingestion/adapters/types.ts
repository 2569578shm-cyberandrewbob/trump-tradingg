import type { IncomingStatement, SourceType } from '../../lib/types.js';

export interface SourceAdapter {
  /** Must match sources.key in the database. */
  readonly key: string;
  readonly type: SourceType;
  /** Fetch statements published after `since`. Must only use legal/official access. */
  fetchLatest(since: Date): Promise<IncomingStatement[]>;
}
