package com.trumptrading.app.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class RiskLevel { Low, Medium, High, Critical;
    companion object {
        fun from(value: String?): RiskLevel = entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: Low
    }
}

@Serializable
data class Alert(
    val id: String,
    val riskLevel: String,
    val categories: List<String> = emptyList(),
    val summary: String,
    val affectedSectors: List<String> = emptyList(),
    val sentiment: String = "Neutral",
    val urgencyScore: Int = 0,
    val reasoning: String = "",
    val title: String = "",
    val confirmed: Boolean = false,
    val createdAt: String = "",
    val originalStatement: String = "",
    val sourceUrl: String = "",
    val statedAt: String = "",
    val detectedAt: String = "",
    val sourceName: String = "",
    val sourceGroup: String = "general",
    val sourceKind: String = "news_fallback",
    val confirmationCount: Int = 0,
    val sourceReliability: Int = 50,
    val tickers: List<String> = emptyList(),
    // ── Market impact (computed by backend) ──
    @SerialName("affected_assets") val affectedAssets: List<AffectedAsset> = emptyList(),
    @SerialName("affected_etfs") val affectedEtfs: List<AffectedEtf> = emptyList(),
    @SerialName("affected_commodities") val affectedCommodities: List<AffectedCommodity> = emptyList(),
    @SerialName("affected_macro_assets") val affectedMacroAssets: List<AffectedMacro> = emptyList(),
    @SerialName("market_impact_summary") val marketImpactSummary: String = "",
) {
    val risk: RiskLevel get() = RiskLevel.from(riskLevel)
    val primaryCategory: String get() = categories.firstOrNull() ?: "General"
    val isOfficial: Boolean get() = sourceKind == "direct_official"
    /** A statement is "confirmed" when flagged confirmed OR corroborated by another source. */
    val isConfirmed: Boolean get() = confirmed || confirmationCount > 0
    val hasMarketImpact: Boolean get() =
        affectedAssets.isNotEmpty() || affectedEtfs.isNotEmpty() ||
        affectedCommodities.isNotEmpty() || affectedMacroAssets.isNotEmpty()
}

@Serializable
data class AffectedAsset(
    val symbol: String,
    val name: String = "",
    @SerialName("asset_type") val assetType: String = "stock",
    val sector: String = "",
    @SerialName("possible_impact") val possibleImpact: String = "uncertain",
    @SerialName("impact_reason") val impactReason: String = "",
    val confidence: Int = 0,
    @SerialName("impact_strength") val impactStrength: String = "low",
    @SerialName("time_sensitivity") val timeSensitivity: String = "short-term",
    @SerialName("risk_note") val riskNote: String = "",
)

@Serializable
data class AffectedEtf(
    val symbol: String,
    val name: String = "",
    val category: String = "ETF",
    @SerialName("possible_impact") val possibleImpact: String = "uncertain",
    val reason: String = "",
    val confidence: Int = 0,
)

@Serializable
data class AffectedCommodity(
    val symbol: String,
    val name: String = "",
    @SerialName("possible_impact") val possibleImpact: String = "uncertain",
    val reason: String = "",
    val confidence: Int = 0,
)

@Serializable
data class AffectedMacro(
    val asset: String,
    @SerialName("possible_impact") val possibleImpact: String = "uncertain",
    val reason: String = "",
    val confidence: Int = 0,
)

// ── /assets/affected aggregate ──
@Serializable
data class AffectedAssetAgg(
    val symbol: String,
    val name: String = "",
    val sector: String? = null,
    val category: String? = null,
    val relatedItems: Int = 0,
    val avgConfidence: Int = 0,
    val dominantImpact: String = "uncertain",
)
@Serializable data class SectorAgg(val sector: String, val count: Int)
@Serializable
data class AffectedMarketsResponse(
    val windowHours: Int = 24,
    val relatedNewsItems: Int = 0,
    val averageUrgency: Int = 0,
    val strongestCategory: String? = null,
    val latestHeadline: String = "",
    val topStocks: List<AffectedAssetAgg> = emptyList(),
    val topEtfs: List<AffectedAssetAgg> = emptyList(),
    val topCommodities: List<AffectedAssetAgg> = emptyList(),
    val topSectors: List<SectorAgg> = emptyList(),
    val disclaimer: String = "",
)

@Serializable data class AlertsResponse(val alerts: List<Alert>)
@Serializable data class SimilarAlert(val id: String, val summary: String, val riskLevel: String, val createdAt: String)
@Serializable data class AlertDetailResponse(val alert: Alert, val similar: List<SimilarAlert> = emptyList())

@Serializable data class SectorCount(val sector: String, val count: Int)
@Serializable data class TickerCount(val ticker: String, val count: Int)
@Serializable
data class DashboardResponse(
    val riskMeter: Int = 0,
    val topSectors: List<SectorCount> = emptyList(),
    val topTickers: List<TickerCount> = emptyList(),
    val categories: List<String> = emptyList(),
)

@Serializable data class AuthRequest(val email: String, val password: String, val displayName: String? = null)
@Serializable
data class AuthResponse(
    val userId: String,
    val accessToken: String,
    val refreshToken: String,
    val role: String = "user",
    val displayName: String? = null,
)
@Serializable data class RefreshRequest(val refreshToken: String)
@Serializable data class FcmTokenRequest(val token: String)
@Serializable data class TickerRequest(val ticker: String)
@Serializable data class WatchlistResponse(val tickers: List<String>)

@Serializable
data class NotificationPrefs(
    val minRiskLevel: String = "High",
    val categories: List<String> = emptyList(),
    val tickersOnly: Boolean = false,
    val quietHoursStart: Int? = null,
    val quietHoursEnd: Int? = null,
    val timezone: String = "UTC",
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
)

@Serializable
data class Source(
    val id: String,
    val key: String,
    val name: String,
    val type: String,
    val url: String? = null,
    val enabled: Boolean = true,
    val reliabilityScore: Int = 50,
    val totalStatements: Int = 0,
    val group: String = "general",
    val kind: String = "news_fallback",
    val status: String = "pending",
    val lastError: String? = null,
    val lastItemCount: Int = 0,
    val lastSuccessAt: String? = null,
) {
    val isOfficial: Boolean get() = kind == "direct_official"
    val groupLabel: String get() = when (group) {
        "official" -> "Official Government"
        "market" -> "Market & Financial News"
        "general" -> "General News"
        "geopolitical" -> "International / Geopolitical"
        "truth_social_direct" -> "Truth Social (Direct)"
        "truth_social_news" -> "Truth Social via News"
        else -> "Other"
    }
}
@Serializable data class SourcesResponse(val sources: List<Source>)
@Serializable data class LegalResponse(val disclaimer: String, val privacyPolicy: String)
@Serializable data class OkResponse(val ok: Boolean = true)

@Serializable
data class HealthChecks(
    val db: String = "unknown",
    val redis: String = "unknown",
)

@Serializable
data class HealthResponse(
    val status: String = "unknown",
    val checks: HealthChecks = HealthChecks(),
    val service: String = "trump-trading-backend",
    val time: String = "",
)
