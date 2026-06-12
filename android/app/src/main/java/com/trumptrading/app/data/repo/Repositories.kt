package com.trumptrading.app.data.repo

import com.trumptrading.app.data.api.ApiService
import com.trumptrading.app.data.local.SessionStore
import com.trumptrading.app.data.model.*
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val session: SessionStore,
) {
    val isLoggedIn = session.isLoggedIn

    suspend fun login(email: String, password: String) {
        val res = api.login(AuthRequest(email, password))
        session.saveSession(res.userId, res.accessToken, res.refreshToken, res.displayName)
        registerFcmToken()
    }

    suspend fun register(email: String, password: String, displayName: String) {
        val res = api.register(AuthRequest(email, password, displayName))
        session.saveSession(res.userId, res.accessToken, res.refreshToken, displayName)
        registerFcmToken()
    }

    suspend fun registerFcmToken() {
        runCatching {
            val token = FirebaseMessaging.getInstance().token.await()
            api.registerFcmToken(FcmTokenRequest(token))
        }
    }

    suspend fun logout() {
        runCatching { api.logout() }
        session.clear()
    }
}

@Singleton
class AlertsRepository @Inject constructor(private val api: ApiService) {
    suspend fun feed(category: String? = null, risk: String? = null, offset: Int = 0): List<Alert> =
        api.getAlerts(category = category, risk = risk, offset = offset).alerts

    suspend fun highImpact(): List<Alert> = api.getHighImpact().alerts
    suspend fun dashboard(): DashboardResponse = api.getDashboard()
    suspend fun detail(id: String): AlertDetailResponse = api.getAlert(id)
    suspend fun byTicker(ticker: String): List<Alert> = api.getAlertsByTicker(ticker).alerts
}

@Singleton
class WatchlistRepository @Inject constructor(private val api: ApiService) {
    suspend fun get(): List<String> = api.getWatchlist().tickers
    suspend fun add(ticker: String): List<String> {
        api.addToWatchlist(TickerRequest(ticker.trim().uppercase()))
        return get()
    }
    suspend fun remove(ticker: String): List<String> {
        api.removeFromWatchlist(ticker)
        return get()
    }
}

@Singleton
class PrefsRepository @Inject constructor(private val api: ApiService) {
    suspend fun get(): NotificationPrefs = api.getPrefs()
    suspend fun update(prefs: NotificationPrefs): NotificationPrefs = api.updatePrefs(prefs)
}

@Singleton
class SourcesRepository @Inject constructor(private val api: ApiService) {
    suspend fun get(): List<Source> = api.getSources().sources
    suspend fun legal(): LegalResponse = api.getLegal()
}
