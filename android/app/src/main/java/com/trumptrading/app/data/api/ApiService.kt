package com.trumptrading.app.data.api

import com.trumptrading.app.data.model.*
import retrofit2.http.*

interface ApiService {
    @POST("auth/register")
    suspend fun register(@Body body: AuthRequest): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body body: AuthRequest): AuthResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): AuthResponse

    @POST("auth/fcm-token")
    suspend fun registerFcmToken(@Body body: FcmTokenRequest): OkResponse

    @POST("auth/logout")
    suspend fun logout(@Body body: Map<String, String> = emptyMap()): OkResponse

    @GET("alerts")
    suspend fun getAlerts(
        @Query("limit") limit: Int = 30,
        @Query("offset") offset: Int = 0,
        @Query("category") category: String? = null,
        @Query("risk") risk: String? = null,
    ): AlertsResponse

    @GET("alerts/high-impact")
    suspend fun getHighImpact(): AlertsResponse

    @GET("alerts/dashboard")
    suspend fun getDashboard(): DashboardResponse

    @GET("alerts/{id}")
    suspend fun getAlert(@Path("id") id: String): AlertDetailResponse

    @GET("alerts/by-category/{category}")
    suspend fun getAlertsByCategory(@Path("category") category: String): AlertsResponse

    @GET("alerts/by-ticker/{ticker}")
    suspend fun getAlertsByTicker(@Path("ticker") ticker: String): AlertsResponse

    @GET("watchlist")
    suspend fun getWatchlist(): WatchlistResponse

    @POST("watchlist")
    suspend fun addToWatchlist(@Body body: TickerRequest): TickerRequest

    @DELETE("watchlist/{ticker}")
    suspend fun removeFromWatchlist(@Path("ticker") ticker: String): OkResponse

    @GET("notification-preferences")
    suspend fun getPrefs(): NotificationPrefs

    @PUT("notification-preferences")
    suspend fun updatePrefs(@Body body: NotificationPrefs): NotificationPrefs

    @GET("sources")
    suspend fun getSources(): SourcesResponse

    @GET("legal/disclaimer")
    suspend fun getLegal(): LegalResponse

    @GET("health")
    suspend fun getHealth(): HealthResponse
}
