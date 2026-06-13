package com.trumptrading.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.model.AffectedAssetAgg
import com.trumptrading.app.data.model.AffectedMarketsResponse
import com.trumptrading.app.data.repo.AlertsRepository
import com.trumptrading.app.ui.components.ErrorBox
import com.trumptrading.app.ui.components.impactColor
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AffectedMarketsUi(
    val loading: Boolean = true,
    val error: String? = null,
    val data: AffectedMarketsResponse? = null,
    val categoryFilter: String? = null,
)

@HiltViewModel
class AffectedMarketsViewModel @Inject constructor(private val repo: AlertsRepository) : ViewModel() {
    private val _state = MutableStateFlow(AffectedMarketsUi())
    val state: StateFlow<AffectedMarketsUi> = _state

    init { load() }

    fun load() {
        _state.value = _state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            runCatching { repo.affectedMarkets() }
                .onSuccess { _state.value = _state.value.copy(loading = false, data = it) }
                .onFailure { _state.value = _state.value.copy(loading = false, error = it.message) }
        }
    }

    fun setFilter(c: String?) { _state.value = _state.value.copy(categoryFilter = c) }
}

private val CATEGORY_FILTERS = listOf(
    "War", "Ceasefire", "Tariffs", "Oil", "Crypto", "Fed", "China", "Iran", "Russia", "Ukraine", "Stocks",
)

@Composable
fun AffectedMarketsScreen(nav: NavHostController, vm: AffectedMarketsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()

    Column(Modifier.fillMaxSize()) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text("Affected Markets", style = MaterialTheme.typography.headlineMedium)
            val d = state.data
            Text(
                if (d != null) "Last ${d.windowHours}h · ${d.relatedNewsItems} related items · avg urgency ${d.averageUrgency}"
                else "Aggregated possible market impact",
                style = MaterialTheme.typography.labelMedium, color = TradingColors.TextSecondary,
            )
            d?.strongestCategory?.let {
                Text("Strongest theme: $it", style = MaterialTheme.typography.labelMedium, color = TradingColors.Accent)
            }
        }

        // Filter chips (category lenses; the page shows aggregate data)
        Row(
            Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            FilterPill("All", state.categoryFilter == null) { vm.setFilter(null) }
            CATEGORY_FILTERS.forEach { c -> FilterPill(c, state.categoryFilter == c) { vm.setFilter(c) } }
        }

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = TradingColors.Accent) }
        }
        state.error?.let { ErrorBox(it) { vm.load() } }

        state.data?.let { data ->
            LazyColumn(
                Modifier.padding(horizontal = 16.dp).padding(top = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (data.latestHeadline.isNotBlank()) {
                    item { LatestHeadlineCard(data.latestHeadline) }
                }
                item { AssetGroup("Top affected stocks", data.topStocks) }
                item { AssetGroup("Top affected ETFs", data.topEtfs) }
                if (data.topCommodities.isNotEmpty()) item { AssetGroup("Top affected commodities", data.topCommodities) }
                item { SectorGroup(data.topSectors.map { it.sector to it.count }) }
                item {
                    Text(
                        data.disclaimer.ifBlank { "Informational only. Not financial advice. Market reactions are uncertain. Verify from original sources before trading." },
                        style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
                        modifier = Modifier.padding(vertical = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun FilterPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .background(if (selected) TradingColors.Accent else TradingColors.Surface, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 13.dp, vertical = 6.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = if (selected) androidx.compose.ui.graphics.Color.White else TradingColors.TextSecondary)
    }
}

@Composable
private fun LatestHeadlineCard(headline: String) {
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text("LATEST RELATED HEADLINE", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
            Spacer(Modifier.height(4.dp))
            Text(headline, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun AssetGroup(title: String, assets: List<AffectedAssetAgg>) {
    if (assets.isEmpty()) return
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, color = TradingColors.Accent)
            assets.forEach { a ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(a.symbol, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, modifier = Modifier.width(64.dp))
                    Column(Modifier.weight(1f)) {
                        Text(a.name, style = MaterialTheme.typography.bodySmall)
                        Text(
                            "${a.sector ?: a.category ?: ""} · ${a.relatedItems} items · conf ${a.avgConfidence}",
                            style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
                        )
                    }
                    Text(
                        "possible ${a.dominantImpact}",
                        style = MaterialTheme.typography.labelSmall, color = impactColor(a.dominantImpact),
                    )
                }
            }
        }
    }
}

@Composable
private fun SectorGroup(sectors: List<Pair<String, Int>>) {
    if (sectors.isEmpty()) return
    val max = sectors.maxOf { it.second }.coerceAtLeast(1)
    Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Top affected sectors", style = MaterialTheme.typography.titleSmall, color = TradingColors.Accent)
            sectors.forEach { (sector, count) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(sector, style = MaterialTheme.typography.bodySmall, modifier = Modifier.width(110.dp))
                    Box(
                        Modifier.weight(1f).height(8.dp)
                            .background(TradingColors.SurfaceHigh, RoundedCornerShape(4.dp)),
                    ) {
                        Box(
                            Modifier.fillMaxWidth(count.toFloat() / max).height(8.dp)
                                .background(TradingColors.Accent, RoundedCornerShape(4.dp)),
                        )
                    }
                    Text("$count", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary, modifier = Modifier.width(36.dp))
                }
            }
        }
    }
}
