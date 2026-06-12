package com.trumptrading.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.BuildConfig
import com.trumptrading.app.data.repo.AuthRepository
import com.trumptrading.app.ui.components.DisclaimerFooter
import com.trumptrading.app.ui.components.SectionHeader
import com.trumptrading.app.ui.nav.Routes
import com.trumptrading.app.ui.nav.toAuth
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    fun logout(onDone: () -> Unit) {
        viewModelScope.launch {
            auth.logout()
            onDone()
        }
    }
}

@Composable
fun SettingsScreen(nav: NavHostController, vm: SettingsViewModel = hiltViewModel()) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))

        SectionHeader("Alerts")
        SettingsRow("Notification preferences") { nav.navigate(Routes.NOTIF_PREFS) }
        SettingsRow("Source reliability") { nav.navigate(Routes.SOURCES) }

        SectionHeader("Legal")
        SettingsRow("Disclaimer & terms") { nav.navigate(Routes.DISCLAIMER) }

        SectionHeader("Account")
        Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
            Row(
                Modifier.fillMaxWidth().clickable { vm.logout { nav.toAuth() } }.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null, tint = TradingColors.Critical)
                Spacer(Modifier.width(12.dp))
                Text("Log out", color = TradingColors.Critical)
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
