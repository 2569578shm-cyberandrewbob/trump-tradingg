package com.trumptrading.app.data.repo

import com.trumptrading.app.data.api.ApiService
import com.trumptrading.app.data.local.SessionStore
import com.trumptrading.app.data.model.*
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Personal-use, single-user app: there is NO login/register UI. A hardcoded
 * local default user (Andrew / personal mode) is provisioned silently so the
 * token-protected backend keeps working. Everything here fails gracefully — if
 * the backend is unreachable the app still opens and screens show empty/error
 * states rather than blocking on a login wall.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val session: SessionStore,
) {
    /** Ensure a backend session exists for the default personal user. Never throws. */
    suspend fun ensurePersonalSession() {
        if (!session.currentAccessToken().isNullOrBlank()) {
            registerFcmToken()
            return
        }
        // Try to log in the default user; if it doesn't exist yet, register it.
        val loggedIn = runCatching { doLogin() }.isSuccess
        if (!loggedIn) {
            runCatching { doRegister() }.onFailure {
                // Registration may fail because the user already exists (race / re-install) — retry login.
                runCatching { doLogin() }
            }
        }
        registerFcmToken()
    }

    private suspend fun doLogin() {
        val res = api.login(AuthRequest(DEFAULT_EMAIL, DEFAULT_PASSWORD))
        session.saveSession(res.userId, res.accessToken, res.refreshToken, res.displayName ?: DEFAULT_NAME)
    }

    private suspend fun doRegister() {
        val res = api.register(AuthRequest(DEFAULT_EMAIL, DEFAULT_PASSWORD, DEFAULT_NAME))
        session.saveSession(res.userId, res.accessToken, res.refreshToken, DEFAULT_NAME)
    }

    private suspend fun registerFcmToken() {
        runCatching {
            val token = FirebaseMessaging.getInstance().token.await()
            api.registerFcmToken(FcmTokenRequest(token))
        }
    }

    companion object {
        // Hardcoded local default user for this personal-use app.
        const val DEFAULT_NAME = "Andrew"
        const val DEFAULT_MODE = "personal"
        private const val DEFAULT_EMAIL = "andrew@personal.local"
        private const val DEFAULT_PASSWORD = "personal-mode-Andrew"
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
