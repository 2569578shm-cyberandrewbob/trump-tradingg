# Known Limitations

## Data access & latency
- **No true second-by-second feed.** Real-time coverage depends entirely on which legal data sources you can access. The ingestion worker polls each source on its own cadence (30–300 s seeded defaults); webhook/streaming sources can be added via the adapter interface when available.
- **Truth Social has no general public API.** The `truth_social` adapter ships **disabled** and is only an integration point for licensed/commercial data access or an official API. Do not point it at scraping endpoints — that violates the platform's terms of service.
- **RSS and news APIs lag the original statement**, sometimes by minutes. The `detected_at` timestamp on every alert is honest about when *we* saw it; `stated_at` is when the source published it.
- **FCM delivery is best-effort.** Push can be delayed by device Doze mode, network conditions, or FCM throttling.

## Analysis quality
- **AI analysis can be wrong.** Risk levels, categories, sentiment, sectors, and tickers are model estimates. The original verbatim statement and source link are always stored and shown so users can verify.
- The rule-based fallback (used when the AI is unavailable or returns invalid JSON) is deliberately conservative: it never assigns Critical and labels its summaries as keyword-based.
- "Historical similar examples" are simple category-overlap lookups, not causal market analysis.

## Safeguards & their limits
- Critical/High alerts require source reliability ≥ 80 **or** confirmation from a second independent source; otherwise they are labeled **UNCONFIRMED** and capped at Medium for notification purposes. This reduces—but cannot eliminate—false alerts (e.g., a reliable source misquoting).
- Duplicate detection (hash + trigram similarity) can miss heavy paraphrases or merge two genuinely different statements that are worded almost identically.
- Reliability scores are heuristics adjusted by admin corrections; they are not editorial truth.

## Product & legal
- **This app is not financial advice.** It never recommends buying or selling. Users must verify statements at the original source and consult a licensed advisor before trading.
- Aggregated news headlines describe *reports about* statements, not always verbatim statements; they are labeled with lower confidence.
- The admin "panel" is an authenticated REST API (Section *Admin* in API.md), not a web UI.
- The privacy policy is a placeholder and must be replaced before any production/store release.
- App-store review (Google Play) may require additional disclosures for finance-adjacent apps; budget time for that.
