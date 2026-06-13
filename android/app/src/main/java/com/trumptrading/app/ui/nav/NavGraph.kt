package com.trumptrading.app.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.trumptrading.app.data.repo.AuthRepository
import com.trumptrading.app.ui.screens.*
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

object Routes {
    const val DASHBOARD = "dashboard"
    const val FEED = "feed"
    const val DETAIL = "alert/{alertId}"
    const val WATCHLIST = "watchlist"
    const val SETTINGS = "settings"
    const val NOTIF_PREFS = "notification_prefs"
    const val SOURCES = "sources"
    const val DISCLAIMER = "disclaimer"

    fun detail(alertId: String) = "alert/$alertId"
}

private data class BottomTab(val route: String, val label: String, val icon: @Composable () -> Unit)

/** Silently provisions the local default user (Andrew / personal). No login UI. */
@HiltViewModel
class AppBootstrapViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    init {
        viewModelScope.launch { runCatching { auth.ensurePersonalSession() } }
    }
}

@Composable
fun AppNavGraph(
    deepLinkAlertId: String?,
    onDeepLinkConsumed: () -> Unit,
    @Suppress("UNUSED_PARAMETER") bootstrap: AppBootstrapViewModel = hiltViewModel(),
) {
    val nav = rememberNavController()

    LaunchedEffect(deepLinkAlertId) {
        if (deepLinkAlertId != null) {
            nav.navigate(Routes.detail(deepLinkAlertId))
            onDeepLinkConsumed()
        }
    }

    val tabs = listOf(
        BottomTab(Routes.DASHBOARD, "Dashboard") { Icon(Icons.Filled.Dashboard, null) },
        BottomTab(Routes.FEED, "Alerts") { Icon(Icons.AutoMirrored.Filled.List, null) },
        BottomTab(Routes.WATCHLIST, "Watchlist") { Icon(Icons.Filled.Star, null) },
        BottomTab(Routes.SETTINGS, "Settings") { Icon(Icons.Filled.Settings, null) },
    )

    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = currentRoute in tabs.map { it.route }

    Scaffold(
        containerColor = TradingColors.Background,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(containerColor = TradingColors.Surface) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(Routes.DASHBOARD) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = tab.icon,
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = Routes.DASHBOARD,
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.DASHBOARD) { DashboardScreen(nav) }
            composable(Routes.FEED) { AlertsFeedScreen(nav) }
            composable(Routes.DETAIL) { entry ->
                AlertDetailScreen(nav, entry.arguments?.getString("alertId").orEmpty())
            }
            composable(Routes.WATCHLIST) { WatchlistScreen(nav) }
            composable(Routes.SETTINGS) { SettingsScreen(nav) }
            composable(Routes.NOTIF_PREFS) { NotificationPrefsScreen(nav) }
            composable(Routes.SOURCES) { SourcesScreen(nav) }
            composable(Routes.DISCLAIMER) { DisclaimerScreen(nav) }
        }
    }
}
