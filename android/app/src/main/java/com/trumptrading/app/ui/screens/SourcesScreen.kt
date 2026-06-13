package com.trumptrading.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import com.trumptrading.app.data.api.toApiError
import com.trumptrading.app.data.model.Source
import com.trumptrading.app.data.repo.SourcesRepository
import com.trumptrading.app.ui.components.ErrorBox
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SourcesUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val sources: List<Source> = emptyList(),
)

@HiltViewModel
class SourcesViewModel @Inject constructor(private val repo: SourcesRepository) : ViewModel() {
    private val _state = MutableStateFlow(SourcesUiState())
    val state: StateFlow<SourcesUiState> = _state
    private var job: kotlinx.coroutines.Job? = null

    init { load() }

    fun load() {
        job?.cancel()
        _state.value = _state.value.copy(loading = true, error = null)
        job = viewModelScope.launch {
            runCatching { repo.get() }
                .onSuccess { _state.value = _state.value.copy(loading = false, sources = it) }
                .onFailure {
                    if (it is kotlinx.coroutines.CancellationException) return@onFailure
                    _state.value = _state.value.copy(loading = false, error = it.toApiError())
                }
        }
    }
}

@Composable
fun SourcesScreen(nav: NavHostController, vm: SourcesViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
            Text("Source reliability", style = MaterialTheme.typography.titleLarge)
        }
        Text(
            "Critical alerts are only sent from high-reliability sources or after independent confirmation. Lower-reliability items are labeled UNCONFIRMED.",
            style = MaterialTheme.typography.bodyMedium, color = TradingColors.TextSecondary,
            modifier = Modifier.padding(vertical = 8.dp),
        )

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
        state.error?.let { ErrorBox(it) { vm.load() } }

        // Summary: connected / failed counts
        if (state.sources.isNotEmpty()) {
            val connected = state.sources.count { it.status == "connected" }
            val failed = state.sources.count { it.status == "failed" }
            Text(
                "$connected connected · $failed failed · ${state.sources.size} total",
                style = MaterialTheme.typography.labelMedium, color = TradingColors.TextSecondary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        // Preserve the requested group order.
        val order = listOf("official", "market", "general", "geopolitical", "truth_social_direct", "truth_social_news")
        val grouped = state.sources.groupBy { it.group }
        val orderedGroups = (order + grouped.keys.filter { it !in order }).filter { grouped.containsKey(it) }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            orderedGroups.forEach { group ->
                val list = grouped[group].orEmpty()
                item(key = "header_$group") {
                    Text(
                        list.firstOrNull()?.groupLabel ?: group,
                        style = MaterialTheme.typography.titleSmall,
                        color = TradingColors.Accent,
                        modifier = Modifier.padding(top = 10.dp, bottom = 2.dp),
                    )
                }
                items(list, key = { it.id }) { source -> SourceCard(source) }
            }
        }
    }
}

@Composable
private fun SourceCard(source: Source) {
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(source.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                StatusChip(source.status)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                val kindColor = if (source.isOfficial) TradingColors.Low else TradingColors.TextSecondary
                Text(
                    if (source.isOfficial) "OFFICIAL" else "NEWS",
                    style = MaterialTheme.typography.labelSmall, color = kindColor,
                )
                Text("·", color = TradingColors.TextSecondary, style = MaterialTheme.typography.labelSmall)
                Text(
                    "Reliability ${source.reliabilityScore}/100 · ${source.lastItemCount} items",
                    style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
                )
            }
            val color = when {
                source.reliabilityScore >= 80 -> TradingColors.Low
                source.reliabilityScore >= 60 -> TradingColors.Medium
                else -> TradingColors.High
            }
            Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(TradingColors.SurfaceHigh)) {
                Box(
                    Modifier.fillMaxWidth(source.reliabilityScore / 100f)
                        .height(6.dp).clip(RoundedCornerShape(3.dp)).background(color),
                )
            }
            source.lastError?.takeIf { source.status == "failed" }?.let {
                Text(it, style = MaterialTheme.typography.labelSmall, color = TradingColors.Critical, maxLines = 2)
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (label, color) = when (status) {
        "connected" -> "CONNECTED" to TradingColors.Low
        "failed" -> "FAILED" to TradingColors.Critical
        "rate_limited" -> "RATE LIMITED" to TradingColors.High
        "no_items" -> "NO ITEMS" to TradingColors.Medium
        "unavailable" -> "UNAVAILABLE" to TradingColors.TextSecondary
        else -> "PENDING" to TradingColors.TextSecondary
    }
    Box(
        Modifier.clip(RoundedCornerShape(20.dp)).background(color.copy(alpha = 0.18f)).padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = color)
    }
}
