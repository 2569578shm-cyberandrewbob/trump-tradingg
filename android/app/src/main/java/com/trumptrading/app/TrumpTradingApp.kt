package com.trumptrading.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class TrumpTradingApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    /** One channel per risk level so users control sound/vibration per severity in system settings. */
    private fun createNotificationChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        val channels = listOf(
            NotificationChannel("risk_critical", "Critical alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Market-critical statements (e.g. announced tariffs, military action)"
                enableVibration(true)
            },
            NotificationChannel("risk_high", "High-impact alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
            },
            NotificationChannel("risk_medium", "Medium alerts", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel("risk_low", "Low / informational", NotificationManager.IMPORTANCE_LOW),
            NotificationChannel("watchlist", "Watchlist matches", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Statements affecting tickers on your watchlist"
                enableVibration(true)
            },
        )
        channels.forEach(manager::createNotificationChannel)
    }
}
