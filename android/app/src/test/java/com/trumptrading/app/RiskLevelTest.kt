package com.trumptrading.app

import com.trumptrading.app.data.model.RiskLevel
import org.junit.Assert.assertEquals
import org.junit.Test

class RiskLevelTest {
    @Test fun `parses exact names`() {
        assertEquals(RiskLevel.Critical, RiskLevel.from("Critical"))
        assertEquals(RiskLevel.High, RiskLevel.from("High"))
    }

    @Test fun `parses case-insensitively`() {
        assertEquals(RiskLevel.Critical, RiskLevel.from("CRITICAL"))
        assertEquals(RiskLevel.Medium, RiskLevel.from("medium"))
    }

    @Test fun `falls back to Low for unknown or null`() {
        assertEquals(RiskLevel.Low, RiskLevel.from("Extreme"))
        assertEquals(RiskLevel.Low, RiskLevel.from(null))
        assertEquals(RiskLevel.Low, RiskLevel.from(""))
    }
}
