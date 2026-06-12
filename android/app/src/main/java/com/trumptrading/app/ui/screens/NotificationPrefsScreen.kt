package com.trumptrading.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.model.NotificationPrefs
import com.trumptrading.app.data.repo.PrefsRepository
import com.trumptrading.app.ui.components.CategoryChip
import com.trumptrading.app.ui.components.ErrorBox
import com.trumptrading.app.ui.components.SectionHeader
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.TimeZone
import javax.inject.Inject

val PREF_CATEGORIES = listOf(
    "War escalation", "Ceasefire / peace deal", "Tariffs", "Sanctions", "China", "Russia",
    "Ukraine", "Middle East", "Iran", "Oil", "Gold", "Crypto", "Interest rates",
    "Federal Reserve", "Inflation", "Taxes", "Trade deals", "Specific companies",
    "Defense sector", "Technology sector", "Energy sector", "Banking sector",
    "Pharmaceuticals", "General financial",
)

data class PrefsUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    val prefs: NotificationPrefs = NotificationPrefs(),
    val saved: Boolean = false,
)

@HiltViewModel
class PrefsViewModel @Inject constructor(private val repo: PrefsRepository) : ViewModel() {
    private val _state = MutableStateFlow(PrefsUiState())
    val state: StateFlow<PrefsUiState> = _state

    init { load() }

    fun load() {
        _state.value = PrefsUiState(loading = true)
        viewModelScope.launch {
            runCatching { repo.get() }
                .onSuccess { _state.value = PrefsUiState(loading = false, prefs = it) }
                .onFailure { _state.value = PrefsUiState(loading = false, error = it.message) }
        }
    }

    fun update(transform: (NotificationPrefs) -> NotificationPrefs) {
        _state.value = _state.value.copy(prefs = transform(_state.value.prefs), saved = false)
    }

    fun save() {
        _state.value = _state.value.copy(saving = true)
        viewModelScope.launch {
            runCatching {
                repo.update(_state.value.prefs.copy(timezone = TimeZone.getDefault().id))
            }
                .onSuccess { _state.value = _state.value.copy(saving = false, prefs = it, saved = true) }
                .onFailure { _state.value = _state.value.copy(saving = false, error = it.message) }
        }
    }
}

@Composable
fun NotificationPrefsScreen(nav: NavHostController, vm: PrefsViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    val p = state.prefs

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
            Text("Notification preferences", style = MaterialTheme.typography.titleLarge)
        }

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Column
        }
        state.error?.let { ErrorBox(it) { vm.load() } }

        SectionHeader("Minimum alert level")
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(
                "Critical" to "Only critical alerts",
                "High" to "Critical + high",
                "Medium" to "Critical + high + medium",
                "Low" to "All alerts",
            ).forEach { (level, label) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = p.minRiskLevel == level, onClick = { vm.update { it.copy(minRiskLevel = level) } })
                    Text(label)
                }
            }
        }

        SectionHeader("Categories (empty = all)")
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PREF_CATEGORIES.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    row.forEach { cat ->
                        CategoryChip(
                            label = cat,
                            selected = cat in p.categories,
                            onClick = {
                                vm.update {
                                    it.copy(categories = if (cat in it.categories) it.categories - cat else it.categories + cat)
                                }
                            },
                        )
                    }
                }
            }
        }

        SectionHeader("Watchlist")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = p.tickersOnly, onCheckedChange = { on -> vm.update { it.copy(tickersOnly = on) } })
            Spacer(Modifier.width(8.dp))
            Text("Only notify for my watchlist tickers")
        }

        SectionHeader("Quiet hours (critical & watchlist alerts still break through)")
        val quietEnabled = p.quietHoursStart != null
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(
                checked = quietEnabled,
                onCheckedChange = { on ->
                    vm.update { it.copy(quietHoursStart = if (on) 22 else null, quietHoursEnd = if (on) 7 else null) }
                },
            )
            Spacer(Modifier.width(8.dp))
            Text(if (quietEnabled) "From ${p.quietHoursStart}:00 to ${p.quietHoursEnd}:00" else "Disabled")
        }
        if (quietEnabled) {
            HourSlider("Start hour", p.quietHoursStart ?: 22) { h -> vm.update { it.copy(quietHoursStart = h) } }
            HourSlider("End hour", p.quietHoursEnd ?: 7) { h -> vm.update { it.copy(quietHoursEnd = h) } }
        }

        SectionHeader("Sound & vibration")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(checked = p.soundEnabled, onCheckedChange = { on -> vm.update { it.copy(soundEnabled = on) } })
            Spacer(Modifier.width(8.dp)); Text("Sound")
            Spacer(Modifier.width(24.dp))
            Switch(checked = p.vibrationEnabled, onCheckedChange = { on -> vm.update { it.copy(vibrationEnabled = on) } })
            Spacer(Modifier.width(8.dp)); Text("Vibration")
        }

        Spacer(Modifier.height(20.dp))
        Button(onClick = { vm.save() }, enabled = !state.saving, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.saved) "Saved ✓" else if (state.saving) "Saving…" else "Save preferences")
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun HourSlider(label: String, value: Int, onChange: (Int) -> Unit) {
    Column {
        Text("$label: $value:00", style = MaterialTheme.typography.labelSmall, color = TradingColors.TextSecondary)
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt().coerceIn(0, 23)) },
            valueRange = 0f..23f,
            steps = 22,
        )
    }
}
