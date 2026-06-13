package com.trumptrading.app.data.model

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
    val sourceReliability: Int = 50,
    val tickers: List<String> = emptyList(),
) {
    val risk: RiskLevel get() = RiskLevel.from(riskLevel)
}

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
)
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
