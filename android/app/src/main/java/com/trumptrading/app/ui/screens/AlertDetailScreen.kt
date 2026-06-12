package com.trumptrading.app.ui.screens

import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.model.AlertDetailResponse
import com.trumptrading.app.data.model.RiskLevel
import com.trumptrading.app.data.repo.AlertsRepository
import com.trumptrading.app.data.repo.WatchlistRepository
import com.trumptrading.app.ui.components.*
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DetailUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val detail: AlertDetailResponse? = null,
    val savedTickers: Set<String> = emptySet(),
)

@HiltViewModel
class AlertDetailViewModel @Inject constructor(
    private val alerts: AlertsRepository,
    private val watchlist: WatchlistRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(DetailUiState())
    val state: StateFlow<DetailUiState> = _state

    fun load(alertId: String) {
        _state.value = DetailUiState(loading = true)
        viewModelScope.launch {
            runCatching { alerts.detail(alertId) to watchlist.get() }
                .onSuccess { (detail, watch) ->
                    _state.value = DetailUiState(loading = false, detail = detail, savedTickers = watch.toSet())
                }
                .onFailure { _state.value = DetailUiState(loading = false, error = it.message) }
        }
    }

    /** "Save" = add the alert's tickers to the user's watchlist. */
    fun saveTickers() {
        val tickers = _state.value.detail?.alert?.tickers ?: return
        viewModelScope.launch {
            runCatching {
                tickers.forEach { watchlist.add(it) }
                watchlist.get()
            }.onSuccess { _state.value = _state.value.copy(savedTickers = it.toSet()) }
        }
    }
}

@Composable
fun AlertDetailScreen(nav: NavHostController, alertId: String, vm: AlertDetailViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(alertId) { vm.load(alertId) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Alert details", style = MaterialTheme.typography.titleLarge)
            Spacer(Modifier.weight(1f))
            state.detail?.alert?.let { alert ->
                IconButton(onClick = {
                    val share = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(
                            Intent.EXTRA_TEXT,
                            "${alert.title}\n\n${alert.summary}\n\nSource: ${alert.sourceUrl}\n(Shared from Trump Trading — not investment advice)",
                        )
                    }
                    context.startActivity(Intent.createChooser(share, "Share alert"))
                }) { Icon(Icons.Filled.Share, contentDescription = "Share") }
            }
        }

        when {
            state.loading -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            state.error != null -> ErrorBox(state.error!!) { vm.load(alertId) }
            state.detail != null -> {
                val alert = state.detail!!.alert
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        RiskBadge(alert.risk)
                        if (!alert.confirmed) UnconfirmedTag()
                        Text(
                            "Sentiment: ${alert.sentiment}",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (alert.sentiment == "Negative") TradingColors.NegativeSentiment
                                    else if (alert.sentiment == "Positive") TradingColors.PositiveSentiment
                                    else TradingColors.TextSecondary,
                        )
                        Spacer(Modifier.weight(1f))
                        Text("Urgency ${alert.urgencyScore}", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
                    }

                    SectionHeader("Original statement")
                    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
                        Text(alert.originalStatement, Modifier.padding(14.dp), style = MaterialTheme.typography.bodyLarge)
                    }

                    SectionHeader("AI summary")
                    Text(alert.summary)

                    SectionHeader("Why this may affect the market")
                    Text(alert.reasoning.ifBlank { "No reasoning available." }, color = TradingColors.TextSecondary)

                    SectionHeader("Categories")
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { alert.categories.forEach { CategoryChip(it) } }

                    if (alert.affectedSectors.isNotEmpty()) {
                        SectionHeader("Affected sectors")
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { alert.affectedSectors.forEach { CategoryChip(it) } }
                    }

                    if (alert.tickers.isNotEmpty()) {
                        SectionHeader("Possible affected tickers")
                        Text(alert.tickers.joinToString("   "), color = TradingColors.Accent)
                        val allSaved = alert.tickers.all { it in state.savedTickers }
                        OutlinedButton(onClick = { vm.saveTickers() }, enabled = !allSaved) {
                            Text(if (allSaved) "Saved to watchlist" else "Save tickers to watchlist")
                        }
                    }

                    SectionHeader("Source")
                    Text("${alert.sourceName}  ·  reliability ${alert.sourceReliability}/100", color = TradingColors.TextSecondary)
                    Text("Stated: ${alert.statedAt}\nDetected: ${alert.detectedAt}", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
                    if (alert.sourceUrl.isNotBlank()) {
                        OutlinedButton(onClick = { uriHandler.openUri(alert.sourceUrl) }) { Text("Open original source") }
                    }

                    if (state.detail!!.similar.isNotEmpty()) {
                        SectionHeader("Historical similar statements")
                        state.detail!!.similar.forEach { s ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = TradingColors.Surface),
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    RiskBadge(RiskLevel.from(s.riskLevel))
                                    Text(s.summary, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                    }

                    DisclaimerFooter()
                }
            }
        }
    }
}
