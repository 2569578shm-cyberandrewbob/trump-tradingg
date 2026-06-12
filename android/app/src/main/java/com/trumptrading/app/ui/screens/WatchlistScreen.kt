package com.trumptrading.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.repo.WatchlistRepository
import com.trumptrading.app.ui.components.CategoryChip
import com.trumptrading.app.ui.components.ErrorBox
import com.trumptrading.app.ui.components.SectionHeader
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

val SUGGESTED_TICKERS = listOf(
    "NVDA", "TSLA", "AAPL", "MSFT", "META", "AMD", "SMCI", "PLTR", "IBM",
    "XOM", "CVX", "LMT", "RTX", "JPM", "BAC", "BTC", "ETH", "GOLD", "OIL",
)

data class WatchlistUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val tickers: List<String> = emptyList(),
)

@HiltViewModel
class WatchlistViewModel @Inject constructor(private val repo: WatchlistRepository) : ViewModel() {
    private val _state = MutableStateFlow(WatchlistUiState())
    val state: StateFlow<WatchlistUiState> = _state

    init { refresh() }

    fun refresh() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            runCatching { repo.get() }
                .onSuccess { _state.value = WatchlistUiState(loading = false, tickers = it) }
                .onFailure { _state.value = WatchlistUiState(loading = false, error = it.message) }
        }
    }

    fun add(ticker: String) {
        if (ticker.isBlank()) return
        viewModelScope.launch {
            runCatching { repo.add(ticker) }
                .onSuccess { _state.value = _state.value.copy(tickers = it, error = null) }
                .onFailure { _state.value = _state.value.copy(error = it.message) }
        }
    }

    fun remove(ticker: String) {
        viewModelScope.launch {
            runCatching { repo.remove(ticker) }
                .onSuccess { _state.value = _state.value.copy(tickers = it) }
        }
    }
}

@Composable
fun WatchlistScreen(nav: NavHostController, vm: WatchlistViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    var input by remember { mutableStateOf("") }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Watchlist", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Statements mentioning your tickers trigger stronger personalized notifications.",
            style = MaterialTheme.typography.bodyMedium, color = TradingColors.TextSecondary,
        )
        Spacer(Modifier.height(16.dp))

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it.uppercase().take(8) },
                label = { Text("Add ticker (e.g. NVDA)") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("watchlist_input"),
            )
            Button(
                onClick = { vm.add(input); input = "" },
                modifier = Modifier.testTag("watchlist_add"),
            ) { Text("Add") }
        }

        state.error?.let { ErrorBox(it) { vm.refresh() } }

        Spacer(Modifier.height(12.dp))
        SectionHeader("Suggestions")
        FlowRowChips(SUGGESTED_TICKERS.filterNot { it in state.tickers }) { vm.add(it) }

        Spacer(Modifier.height(12.dp))
        SectionHeader("Your tickers (${state.tickers.size})")
        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.tickers, key = { it }) { ticker ->
                Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(ticker, style = MaterialTheme.typography.titleMedium, color = TradingColors.Accent)
                        Spacer(Modifier.weight(1f))
                        IconButton(onClick = { vm.remove(ticker) }) {
                            Icon(Icons.Filled.Delete, contentDescription = "Remove $ticker", tint = TradingColors.TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FlowRowChips(tickers: List<String>, onClick: (String) -> Unit) {
    // simple wrapping rows of 5
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        tickers.chunked(5).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { t -> CategoryChip(t, onClick = { onClick(t) }) }
            }
        }
    }
}
