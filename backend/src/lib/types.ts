export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SENTIMENTS = ['Positive', 'Negative', 'Neutral', 'Mixed'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const CATEGORIES = [
  'War escalation',
  'Ceasefire / peace deal',
  'Tariffs',
  'Sanctions',
  'China',
  'Russia',
  'Ukraine',
  'Middle East',
  'Iran',
  'Oil',
  'Gold',
  'Crypto',
  'Interest rates',
  'Federal Reserve',
  'Inflation',
  'Taxes',
  'Trade deals',
  'Specific companies',
  'Defense sector',
  'Technology sector',
  'Energy sector',
  'Banking sector',
  'Pharmaceuticals',
  'General financial',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type SourceType = 'truth_social' | 'rss' | 'news_api' | 'transcript' | 'gov_feed';

export interface IncomingStatement {
  externalId?: string;
  content: string;
  sourceUrl: string;
  statedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface AiAnalysis {
  isMarketRelevant: boolean;
  riskLevel: RiskLevel;
  categories: Category[];
  summary: string;
  affectedSectors: string[];
  affectedTickers: string[];
  sentiment: Sentiment;
  urgencyScore: number;
  reasoning: string;
  notificationTitle: string;
  notificationBody: string;
}

export function riskRank(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}
