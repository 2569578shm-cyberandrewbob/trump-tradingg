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

    init { load() }

    fun load() {
        _state.value = SourcesUiState(loading = true)
        viewModelScope.launch {
            runCatching { repo.get() }
                .onSuccess { _state.value = SourcesUiState(loading = false, sources = it) }
                .onFailure { _state.value = SourcesUiState(loading = false, error = it.message) }
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

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.sources, key = { it.id }) { source ->
                Card(colors = CardDefaults.cardColors(containerColor = TradingColors.Surface)) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(source.name, style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.weight(1f))
                            if (!source.enabled) {
                                Text("DISABLED", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
                            }
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
                        Text(
                            "Reliability ${source.reliabilityScore}/100 · ${source.totalStatements} statements · ${source.type}",
                            style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary,
                        )
                    }
                }
            }
        }
    }
}
