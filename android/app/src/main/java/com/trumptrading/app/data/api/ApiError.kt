package com.trumptrading.app.data.api

import com.trumptrading.app.BuildConfig
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

data class ApiError(
    val url: String,
    val method: String,
    val statusCode: Int,
    val message: String,
    val body: String? = null
) {
    override fun toString(): String {
        return "HTTP $statusCode at $url. $message"
    }
}

fun Throwable.toApiError(): String {
    val base = BuildConfig.API_BASE_URL
    return when (this) {
        is HttpException -> {
            val response = response()
            val url = response?.raw()?.request?.url?.toString() ?: "unknown url"
            val code = response?.code() ?: 0
            val body = response?.errorBody()?.string()
            when (code) {
                // Render free tier spins down idle services; first hit returns 502/503/504.
                502, 503, 504 ->
                    "Backend is waking up (free hosting sleeps when idle).\nWait ~30 seconds and tap Retry.\n($code at $url)"
                404 ->
                    "HTTP 404 at $url.\nEndpoint not found on the backend.\nBody: ${body ?: "none"}"
                401 ->
                    "HTTP 401 at $url.\nNot authorized — the app will try to re-authenticate.\nBody: ${body ?: "none"}"
                else ->
                    "HTTP $code at $url.\n${response?.message() ?: "Error"}\nBody: ${body ?: "none"}"
            }
        }
        // DNS failure: the backend hostname does not resolve — it is not deployed,
        // or the URL is wrong, or there is no internet.
        is UnknownHostException ->
            "Cannot reach the backend host.\nAPI_BASE_URL = $base\n" +
            "The backend may not be deployed yet, the URL may be wrong, or you have no internet.\n(${this.message})"
        is SocketTimeoutException ->
            "Backend timed out.\nAPI_BASE_URL = $base\nIt may be waking up (free hosting) — wait ~30s and retry."
        is IOException ->
            "Network error: ${this.message}.\nAPI_BASE_URL = $base\nCheck your internet connection or backend reachability."
        else -> this.message ?: this::class.simpleName ?: "Unknown error"
    }
}
