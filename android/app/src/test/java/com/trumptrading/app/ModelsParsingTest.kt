package com.trumptrading.app

import com.trumptrading.app.data.model.Alert
import com.trumptrading.app.data.model.AlertsResponse
import com.trumptrading.app.data.model.DashboardResponse
import com.trumptrading.app.data.model.RiskLevel
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mock-data tests: backend JSON payloads must decode into app models. */
class ModelsParsingTest {

    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private val mockAlert = """
        {
          "id": "5f8d8a2e-1111-2222-3333-444455556666",
          "riskLevel": "Critical",
          "categories": ["Tariffs", "China"],
          "summary": "Possible 50% tariff on Chinese imports.",
          "affectedSectors": ["Technology", "Retail"],
          "sentiment": "Negative",
          "urgencyScore": 95,
          "reasoning": "Direct tariff threat.",
          "title": "CRITICAL: Trump tariff statement detected",
          "confirmed": true,
          "createdAt": "2026-06-12T10:00:00Z",
          "originalStatement": "We may impose a 50% tariff on Chinese imports.",
          "sourceUrl": "https://example.com/post",
          "statedAt": "2026-06-12T09:58:00Z",
          "detectedAt": "2026-06-12T09:59:02Z",
          "sourceName": "White House — Briefing Room",
          "sourceReliability": 95,
          "tickers": ["AAPL", "NVDA", "TSLA"],
          "someFutureField": "ignored"
        }
    """.trimIndent()

    @Test fun `decodes a full alert payload`() {
        val alert = json.decodeFromString<Alert>(mockAlert)
        assertEquals(RiskLevel.Critical, alert.risk)
        assertEquals(listOf("Tariffs", "China"), alert.categories)
        assertEquals(3, alert.tickers.size)
        assertTrue(alert.confirmed)
    }

    @Test fun `decodes alert list wrapper`() {
        val res = json.decodeFromString<AlertsResponse>("""{"alerts": [$mockAlert]}""")
        assertEquals(1, res.alerts.size)
    }

    @Test fun `tolerates missing optional fields`() {
        val minimal = """{"id":"x","riskLevel":"High","summary":"s"}"""
        val alert = json.decodeFromString<Alert>(minimal)
        assertEquals(RiskLevel.High, alert.risk)
        assertTrue(alert.tickers.isEmpty())
    }

    @Test fun `decodes dashboard payload`() {
        val res = json.decodeFromString<DashboardResponse>(
            """{"riskMeter":62,"topSectors":[{"sector":"Energy","count":4}],"topTickers":[{"ticker":"OIL","count":3}],"categories":["Oil"]}""",
        )
        assertEquals(62, res.riskMeter)
        assertEquals("Energy", res.topSectors.first().sector)
    }
}
