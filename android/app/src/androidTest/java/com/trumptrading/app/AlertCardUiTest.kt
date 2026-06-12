package com.trumptrading.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.trumptrading.app.data.model.Alert
import com.trumptrading.app.ui.components.AlertCard
import com.trumptrading.app.ui.theme.TrumpTradingTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class AlertCardUiTest {

    @get:Rule
    val compose = createComposeRule()

    private val alert = Alert(
        id = "a1",
        riskLevel = "Critical",
        categories = listOf("Tariffs", "China"),
        summary = "Possible 50% tariff on Chinese imports.",
        confirmed = false,
        sourceName = "White House",
        tickers = listOf("AAPL", "NVDA"),
    )

    @Test
    fun showsRiskBadgeSummaryAndUnconfirmedTag() {
        compose.setContent {
            TrumpTradingTheme { AlertCard(alert) {} }
        }
        compose.onNodeWithTag("risk_badge_Critical").assertIsDisplayed()
        compose.onNodeWithText("Possible 50% tariff on Chinese imports.").assertIsDisplayed()
        compose.onNodeWithText("UNCONFIRMED").assertIsDisplayed()
    }

    @Test
    fun clickInvokesCallback() {
        var clicked = false
        compose.setContent {
            TrumpTradingTheme { AlertCard(alert) { clicked = true } }
        }
        compose.onNodeWithTag("alert_card").performClick()
        assertTrue(clicked)
    }
}
