package com.trumptrading.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.model.Alert
import com.trumptrading.app.data.repo.AlertsRepository
import com.trumptrading.app.ui.components.AlertCard
import com.trumptrading.app.ui.components.CategoryChip
import com.trumptrading.app.ui.components.ErrorBox
import com.trumptrading.app.ui.nav.Routes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val alerts: List<Alert> = emptyList(),
    val riskFilter: String? = null,
    val endReached: Boolean = false,
)

@HiltViewModel
class FeedViewModel @Inject constructor(private val repo: AlertsRepository) : ViewModel() {
    private val _state = MutableStateFlow(FeedUiState())
    val state: StateFlow<FeedUiState> = _state

    init { refresh() }

    fun refresh(risk: String? = _state.value.riskFilter) {
        _state.value = FeedUiState(loading = true, riskFilter = risk)
        viewModelScope.launch {
            runCatching { repo.feed(risk = risk) }
                .onSuccess { _state.value = FeedUiState(loading = false, alerts = it, riskFilter = risk, endReached = it.size < 30) }
                .onFailure { _state.value = FeedUiState(loading = false, error = it.message, riskFilter = risk) }
        }
    }

    fun loadMore() {
        val s = _state.value
        if (s.loading || s.endReached) return
        _state.value = s.copy(loading = true)
        viewModelScope.launch {
            runCatching { repo.feed(risk = s.riskFilter, offset = s.alerts.size) }
                .onSuccess {
                    _state.value = s.copy(loading = false, alerts = s.alerts + it, endReached = it.size < 30)
                }
                .onFailure { _state.value = s.copy(loading = false, error = it.message) }
        }
    }
}

@Composable
fun AlertsFeedScreen(nav: NavHostController, vm: FeedViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text("Live alerts", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(vertical = 16.dp))

        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Critical", "High", "Medium", "Low").forEach { risk ->
                CategoryChip(
                    label = risk,
                    selected = state.riskFilter == risk,
                    onClick = { vm.refresh(if (state.riskFilter == risk) null else risk) },
                )
            }
        }
        Spacer(Modifier.height(10.dp))

        state.error?.let { ErrorBox(it) { vm.refresh() } }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            contentPadding = PaddingValues(bottom = 16.dp),
        ) {
            items(state.alerts, key = { it.id }) { alert ->
                AlertCard(alert) { nav.navigate(Routes.detail(alert.id)) }
            }
            item {
                when {
                    state.loading -> Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                    !state.endReached -> TextButton(
                        onClick = { vm.loadMore() },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Load more") }
                }
            }
        }
    }
}
