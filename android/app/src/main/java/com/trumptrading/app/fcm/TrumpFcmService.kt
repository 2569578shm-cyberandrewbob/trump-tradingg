package com.trumptrading.app.fcm

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.trumptrading.app.MainActivity
import com.trumptrading.app.R
import com.trumptrading.app.data.api.ApiService
import com.trumptrading.app.data.model.FcmTokenRequest
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class TrumpFcmService : FirebaseMessagingService() {

    @Inject lateinit var api: ApiService
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        scope.launch { runCatching { api.registerFcmToken(FcmTokenRequest(token)) } }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val alertId = data["alertId"] ?: return
        val risk = (data["riskLevel"] ?: "Low").lowercase()
        val title = message.notification?.title ?: data["title"] ?: "Market alert"
        val body = message.notification?.body ?: data["body"] ?: ""
        val personalized = title.startsWith("⚠ WATCHLIST")
        val channel = if (personalized) "watchlist" else "risk_$risk"

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("alertId", alertId)
        }
        val pending = PendingIntent.getActivity(
            this, alertId.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(
                if (risk == "critical" || personalized) NotificationCompat.PRIORITY_MAX
                else NotificationCompat.PRIORITY_HIGH,
            )
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        runCatching {
            NotificationManagerCompat.from(this).notify(alertId.hashCode(), notification)
        }
    }
}
