package com.trumptrading.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.navigation.NavHostController
import com.trumptrading.app.data.repo.AuthRepository
import com.trumptrading.app.ui.nav.toAuth
import com.trumptrading.app.ui.nav.toDashboard
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    suspend fun isLoggedIn(): Boolean = auth.isLoggedIn.first()
}

@Composable
fun SplashScreen(nav: NavHostController, vm: SplashViewModel = hiltViewModel()) {
    LaunchedEffect(Unit) {
        delay(900)
        if (vm.isLoggedIn()) nav.toDashboard() else nav.toAuth()
    }
    Column(
        Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("TRUMP TRADING", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text("Political statements. Market speed.", color = TradingColors.TextSecondary)
        Spacer(Modifier.height(32.dp))
        Text(
            "Not investment advice",
            style = MaterialTheme.typography.labelSmall,
            color = TradingColors.TextSecondary,
        )
    }
}
