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
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.trumptrading.app.ui.screens.*
import com.trumptrading.app.ui.theme.TradingColors

object Routes {
    const val SPLASH = "splash"
    const val AUTH = "auth"
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

@Composable
fun AppNavGraph(deepLinkAlertId: String?, onDeepLinkConsumed: () -> Unit) {
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
            startDestination = Routes.SPLASH,
            modifier = Modifier.padding(padding),
        ) {
            composable(Routes.SPLASH) { SplashScreen(nav) }
            composable(Routes.AUTH) { AuthScreen(nav) }
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

fun NavHostController.toAuth() = navigate(Routes.AUTH) { popUpTo(0) }
fun NavHostController.toDashboard() = navigate(Routes.DASHBOARD) { popUpTo(0) }
