package com.trumptrading.app.data.api

import com.trumptrading.app.data.local.SessionStore
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(private val session: SessionStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath
        if (path.startsWith("/auth/login") || path.startsWith("/auth/register") || path.startsWith("/auth/refresh")) {
            return chain.proceed(request)
        }
        val token = runBlocking { session.currentAccessToken() }
        val authed = if (token.isNullOrBlank()) request else
            request.newBuilder().header("Authorization", "Bearer $token").build()
        return chain.proceed(authed)
    }
}
