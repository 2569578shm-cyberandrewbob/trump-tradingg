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
import com.trumptrading.app.data.repo.SourcesRepository
import com.trumptrading.app.ui.components.SectionHeader
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val FALLBACK_DISCLAIMER =
    "Trump Trading provides informational alerts about public political statements. It does NOT provide " +
    "investment, financial, legal, or tax advice. AI-generated analysis may be inaccurate, incomplete, or " +
    "delayed. Alerts can be delayed by upstream sources. Always verify statements at the original source " +
    "and consult a licensed financial advisor before making trading decisions. You are solely responsible " +
    "for your trades."

@HiltViewModel
class DisclaimerViewModel @Inject constructor(private val repo: SourcesRepository) : ViewModel() {
    private val _text = MutableStateFlow(FALLBACK_DISCLAIMER to "")
    val text: StateFlow<Pair<String, String>> = _text

    init {
        viewModelScope.launch {
            runCatching { repo.legal() }.onSuccess { _text.value = it.disclaimer to it.privacyPolicy }
        }
    }
}

@Composable
fun DisclaimerScreen(nav: NavHostController, vm: DisclaimerViewModel = hiltViewModel()) {
    val (disclaimer, privacy) by vm.text.collectAsState()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { nav.popBackStack() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
            Text("Disclaimer & terms", style = MaterialTheme.typography.titleLarge)
        }

        SectionHeader("Not investment advice")
        Text(disclaimer)

        SectionHeader("Data sources & delays")
        Text(
            "Statement monitoring depends on legally accessible public sources and their APIs. Some platforms " +
            "do not provide real-time access; alerts can be delayed by source speed, polling intervals, and " +
            "push delivery. Unconfirmed reports are clearly labeled.",
            color = TradingColors.TextSecondary,
        )

        SectionHeader("AI limitations")
        Text(
            "Risk levels, categories, sentiment, and ticker lists are AI estimates and may be wrong. " +
            "The original statement and its source link are always provided so you can verify.",
            color = TradingColors.TextSecondary,
        )

        if (privacy.isNotBlank()) {
            SectionHeader("Privacy policy")
            Text(privacy, color = TradingColors.TextSecondary)
        }
        Spacer(Modifier.height(24.dp))
    }
}
