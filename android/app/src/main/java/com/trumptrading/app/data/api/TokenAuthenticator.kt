package com.trumptrading.app.data.api

import com.trumptrading.app.data.local.SessionStore
import com.trumptrading.app.data.model.RefreshRequest
import dagger.Lazy
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenAuthenticator @Inject constructor(
    private val session: SessionStore,
    private val api: Lazy<ApiService>,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Don't try to refresh if the refresh call itself failed
        if (response.request.url.encodedPath.contains("/auth/refresh")) return null

        val refreshToken = runBlocking { session.currentRefreshToken() } ?: return null

        synchronized(this) {
            val currentToken = runBlocking { session.currentAccessToken() }
            val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")

            // If the token was already refreshed by another thread, retry with the new token.
            if (currentToken != requestToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .build()
            }

            return runCatching {
                runBlocking {
                    val res = api.get().refresh(RefreshRequest(refreshToken))
                    session.updateTokens(res.accessToken, res.refreshToken)
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${res.accessToken}")
                        .build()
                }
            }.getOrNull()
        }
    }
}
