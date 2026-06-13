package com.trumptrading.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.trumptrading.app.BuildConfig
import com.trumptrading.app.data.repo.AuthRepository
import com.trumptrading.app.ui.components.DisclaimerFooter
import com.trumptrading.app.ui.components.SectionHeader
import com.trumptrading.app.ui.nav.Routes
import com.trumptrading.app.ui.theme.TradingColors

@Composable
fun SettingsScreen(nav: NavHostController) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))

        SectionHeader("Alerts")
        SettingsRow("Notification preferences") { nav.navigate(Routes.NOTIF_PREFS) }
        SettingsRow("Source reliability") { nav.navigate(Routes.SOURCES) }

        SectionHeader("Legal")
        SettingsRow("Disclaimer & terms") { nav.navigate(Routes.DISCLAIMER) }

        SectionHeader("Developer")
        SettingsRow("Diagnostics / connection test") { nav.navigate(Routes.DIAGNOSTICS) }

        // Personal-use app: single local user, no login/logout.
        SectionHeader("Profile")
        Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
            Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(AuthRepository.DEFAULT_NAME)
                Spacer(Modifier.weight(1f))
                Text(
                    "${AuthRepository.DEFAULT_MODE} mode",
                    style = MaterialTheme.typography.labelSmall,
                    color = TradingColors.TextSecondary,
                )
            }
        }

        Spacer(Modifier.weight(1f))
        Text(
            "Version ${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
        )
        DisclaimerFooter()
    }
}

@Composable
private fun SettingsRow(label: String, onClick: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Row(
            Modifier.fillMaxWidth().clickable(onClick = onClick).padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(label)
            Spacer(Modifier.weight(1f))
            Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = TradingColors.TextSecondary)
        }
    }
}
