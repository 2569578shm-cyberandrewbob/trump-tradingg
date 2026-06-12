package com.trumptrading.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.model.Alert
import com.trumptrading.app.data.model.DashboardResponse
import com.trumptrading.app.data.repo.AlertsRepository
import com.trumptrading.app.ui.components.*
import com.trumptrading.app.ui.nav.Routes
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// Quick filters shown on the dashboard, mapped to backend category names.
val DASHBOARD_FILTERS = listOf(
    "War" to "War escalation",
    "Ceasefire" to "Ceasefire / peace deal",
    "Tariffs" to "Tariffs",
    "Stocks" to "Specific companies",
    "Oil" to "Oil",
    "Crypto" to "Crypto",
    "Fed" to "Federal Reserve",
    "China" to "China",
    "Middle East" to "Middle East",
    "Companies" to "Specific companies",
)

data class DashboardUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val dashboard: DashboardResponse = DashboardResponse(),
    val highImpact: List<Alert> = emptyList(),
    val recent: List<Alert> = emptyList(),
    val activeFilter: String? = null,
)

@HiltViewModel
class DashboardViewModel @Inject constructor(private val repo: AlertsRepository) : ViewModel() {
    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state

    init { refresh() }

    fun refresh(filter: String? = _state.value.activeFilter) {
        _state.value = _state.value.copy(loading = true, error = null, activeFilter = filter)
        viewModelScope.launch {
            runCatching {
                val dashboard = repo.dashboard()
                val high = repo.highImpact()
                val recent = repo.feed(category = filter)
                Triple(dashboard, high, recent)
            }.onSuccess { (dashboard, high, recent) ->
                _state.value = _state.value.copy(
                    loading = false, dashboard = dashboard, highImpact = high, recent = recent,
                )
            }.onFailure {
                _state.value = _state.value.copy(loading = false, error = it.message ?: "Failed to load")
            }
        }
    }
}

@Composable
fun DashboardScreen(nav: NavHostController, vm: DashboardViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(vertical = 16.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Dashboard", style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { vm.refresh() }) { Text("Refresh") }
            }
        }

        item { RiskMeter(state.dashboard.riskMeter) }

        item {
            Row(
                Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                DASHBOARD_FILTERS.distinctBy { it.second }.forEach { (label, category) ->
                    CategoryChip(
                        label = label,
                        selected = state.activeFilter == category,
                        onClick = { vm.refresh(if (state.activeFilter == category) null else category) },
                    )
                }
            }
        }

        if (state.error != null) {
            item { ErrorBox(state.error!!) { vm.refresh() } }
        }

        if (state.dashboard.topSectors.isNotEmpty()) {
            item {
                SectionHeader("Top affected sectors (24h)")
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    state.dashboard.topSectors.forEach { CategoryChip("${it.sector} (${it.count})") }
                }
            }
        }
        if (state.dashboard.topTickers.isNotEmpty()) {
            item {
                SectionHeader("Top mentioned tickers (24h)")
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    state.dashboard.topTickers.forEach { CategoryChip("${it.ticker} ×${it.count}") }
                }
            }
        }

        if (state.highImpact.isNotEmpty() && state.activeFilter == null) {
            item { SectionHeader("High-impact alerts") }
            items(state.highImpact.take(5), key = { "high-${it.id}" }) { alert ->
                AlertCard(alert) { nav.navigate(Routes.detail(alert.id)) }
            }
        }

        item { SectionHeader(if (state.activeFilter != null) "Filtered statements" else "Recent statements") }
        if (state.loading) {
            item {
                Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
        }
        items(state.recent, key = { it.id }) { alert ->
            AlertCard(alert) { nav.navigate(Routes.detail(alert.id)) }
        }

        item { DisclaimerFooter() }
    }
}

/** 0–100 market risk meter derived from average urgency of the last 24h. */
@Composable
private fun RiskMeter(score: Int) {
    val color = when {
        score >= 75 -> TradingColors.Critical
        score >= 50 -> TradingColors.High
        score >= 25 -> TradingColors.Medium
        else -> TradingColors.Low
    }
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row {
                Text("Market risk meter", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                Text("$score / 100", style = MaterialTheme.typography.titleMedium, color = color)
            }
            Box(
                Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(TradingColors.SurfaceHigh),
            ) {
                Box(
                    Modifier.fillMaxWidth(fraction = (score.coerceIn(0, 100)) / 100f)
                        .height(8.dp).clip(RoundedCornerShape(4.dp)).background(color),
                )
            }
            Text(
                "Average urgency of statements detected in the last 24 hours.",
                style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
            )
        }
    }
}
