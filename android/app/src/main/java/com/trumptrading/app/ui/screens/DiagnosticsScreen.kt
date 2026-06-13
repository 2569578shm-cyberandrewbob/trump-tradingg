package com.trumptrading.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.BuildConfig
import com.trumptrading.app.data.api.ApiService
import com.trumptrading.app.data.model.HealthResponse
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class DiagnosticsViewModel @Inject constructor(private val api: ApiService) : ViewModel() {

    data class State(
        val loading: Boolean = false,
        val health: HealthResponse? = null,
        val error: String? = null,
        val checkedAt: String? = null,
        val alertCount: Int? = null,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state

    init { check() }

    fun check() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val h = api.getHealth()
                val alertCount = runCatching { api.getAlerts(limit = 1).alerts.size }.getOrNull()
                _state.value = State(
                    loading = false,
                    health = h,
                    alertCount = alertCount,
                    checkedAt = now(),
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: e::class.simpleName ?: "Unknown error",
                    checkedAt = now(),
                )
            }
        }
    }

    private fun now(): String {
        val fmt = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(ZoneId.of("Africa/Cairo"))
        return fmt.format(Instant.now()) + " Cairo"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticsScreen(nav: NavHostController, vm: DiagnosticsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()

    Scaffold(
        containerColor = TradingColors.Background,
        topBar = {
            TopAppBar(
                title = { Text("Diagnostics") },
                navigationIcon = {
                    IconButton(onClick = { nav.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = TradingColors.Surface),
                actions = {
                    IconButton(onClick = { vm.check() }, enabled = !state.loading) {
                        if (state.loading)
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = TradingColors.Accent,
                            )
                        else
                            Icon(Icons.Filled.Refresh, contentDescription = "Re-check")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // ── API URL ────────────────────────────────────────────────────
            DiagCard(title = "Backend URL") {
                MonoText(BuildConfig.API_BASE_URL)
                if (BuildConfig.API_BASE_URL.startsWith("http://")) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "⚠ Cleartext HTTP — this will be blocked on a real device. Update TRUMP_TRADING_API_URL in gradle.properties to an HTTPS URL.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TradingColors.Critical,
                    )
                }
            }

            // ── Health check result ────────────────────────────────────────
            DiagCard(title = "Backend Health") {
                if (state.loading) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = TradingColors.Accent)
                        Text("Checking…", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                    }
                } else if (state.error != null) {
                    StatusRow("Backend reachable", false)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        state.error!!,
                        style = MaterialTheme.typography.bodySmall,
                        color = TradingColors.Critical,
                        fontFamily = FontFamily.Monospace,
                    )
                } else if (state.health != null) {
                    val h = state.health!!
                    val ok = h.status == "ok"
                    StatusRow("Backend reachable", true)
                    StatusRow("Status: ${h.status}", ok)
                    StatusRow("Database", h.checks.db == "ok")
                    StatusRow("Redis", h.checks.redis == "ok")
                    Spacer(Modifier.height(4.dp))
                    Text("Server time: ${h.time}", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                }
                if (state.checkedAt != null) {
                    Spacer(Modifier.height(4.dp))
                    Text("Last checked: ${state.checkedAt}", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
                }
            }

            // ── Feed data ──────────────────────────────────────────────────
            DiagCard(title = "Live Feed") {
                if (state.loading) {
                    Text("Checking…", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                } else if (state.alertCount != null) {
                    StatusRow("Alerts endpoint reachable", true)
                    Text(
                        if (state.alertCount!! > 0) "✓ Feed has items" else "⚠ Feed returned 0 items — backend may need ingestion to run",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (state.alertCount!! > 0) TradingColors.Low else TradingColors.Medium,
                    )
                } else if (state.error != null) {
                    StatusRow("Alerts endpoint reachable", false)
                }
            }

            // ── Build info ─────────────────────────────────────────────────
            DiagCard(title = "Build Info") {
                MonoText("Version:    ${com.trumptrading.app.BuildConfig.VERSION_NAME}")
                MonoText("Build type: ${com.trumptrading.app.BuildConfig.BUILD_TYPE}")
                MonoText("App ID:     ${com.trumptrading.app.BuildConfig.APPLICATION_ID}")
            }

            // ── Next steps if broken ────────────────────────────────────────
            if (state.error != null) {
                DiagCard(title = "Fix Checklist") {
                    Text("1. Open android/gradle.properties", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                    Text("2. Set TRUMP_TRADING_API_URL=https://your-deployed-url/", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                    Text("3. Rebuild: ./gradlew assembleDebug", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                    Text("4. See docs/DEPLOYMENT.md for cloud setup", style = MaterialTheme.typography.bodySmall, color = TradingColors.TextSecondary)
                }
            }
        }
    }
}

@Composable
private fun DiagCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = TradingColors.Surface),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = TradingColors.TextSecondary)
            Spacer(Modifier.height(4.dp))
            content()
        }
    }
}

@Composable
private fun StatusRow(label: String, ok: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            if (ok) Icons.Filled.CheckCircle else Icons.Filled.Error,
            contentDescription = null,
            tint = if (ok) TradingColors.Low else TradingColors.Critical,
            modifier = Modifier.size(16.dp),
        )
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun MonoText(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        fontFamily = FontFamily.Monospace,
        color = TradingColors.TextSecondary,
    )
}
