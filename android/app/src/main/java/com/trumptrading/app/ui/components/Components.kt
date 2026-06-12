package com.trumptrading.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trumptrading.app.data.model.Alert
import com.trumptrading.app.data.model.RiskLevel
import com.trumptrading.app.ui.theme.TradingColors
import com.trumptrading.app.ui.theme.riskColor

@Composable
fun RiskBadge(risk: RiskLevel, modifier: Modifier = Modifier) {
    val color = riskColor(risk)
    Text(
        text = risk.name.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = if (risk == RiskLevel.Medium) Color.Black else Color.White,
        modifier = modifier
            .background(color, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
            .testTag("risk_badge_${risk.name}"),
    )
}

@Composable
fun CategoryChip(label: String, selected: Boolean = false, onClick: (() -> Unit)? = null) {
    val bg = if (selected) TradingColors.Accent else TradingColors.SurfaceHigh
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = if (selected) Color.White else TradingColors.TextSecondary,
        modifier = Modifier
            .background(bg, RoundedCornerShape(16.dp))
            .border(1.dp, TradingColors.Border, RoundedCornerShape(16.dp))
            .let { m -> if (onClick != null) m.clickable(onClick = onClick) else m }
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

@Composable
fun UnconfirmedTag() {
    Text(
        text = "UNCONFIRMED",
        style = MaterialTheme.typography.labelSmall,
        color = TradingColors.High,
        modifier = Modifier
            .border(1.dp, TradingColors.High, RoundedCornerShape(4.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun AlertCard(alert: Alert, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = TradingColors.Surface),
        border = CardDefaults.outlinedCardBorder().copy(width = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("alert_card"),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RiskBadge(alert.risk)
                if (!alert.confirmed) UnconfirmedTag()
                Spacer(Modifier.weight(1f))
                Text(alert.sourceName, style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
            }
            Text(
                alert.summary,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                alert.categories.take(3).forEach { CategoryChip(it) }
            }
            if (alert.tickers.isNotEmpty()) {
                Text(
                    alert.tickers.take(6).joinToString("  "),
                    style = MaterialTheme.typography.labelSmall,
                    color = TradingColors.Accent,
                )
            }
        }
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        title.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = TradingColors.TextSecondary,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
}

@Composable
fun ErrorBox(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(message, color = TradingColors.TextSecondary)
        OutlinedButton(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
fun DisclaimerFooter() {
    Text(
        "Informational only — not investment advice. AI analysis may be wrong. Verify at the source before trading.",
        style = MaterialTheme.typography.labelSmall,
        color = TradingColors.TextSecondary,
        modifier = Modifier.fillMaxWidth().padding(12.dp),
    )
}
