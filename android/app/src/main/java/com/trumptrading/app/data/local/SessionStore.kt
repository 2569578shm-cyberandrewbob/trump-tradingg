package com.trumptrading.app.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "session")

@Singleton
class SessionStore @Inject constructor(@ApplicationContext private val context: Context) {

    private object Keys {
        val ACCESS = stringPreferencesKey("access_token")
        val REFRESH = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val DISPLAY_NAME = stringPreferencesKey("display_name")
    }

    val accessToken: Flow<String?> = context.dataStore.data.map { it[Keys.ACCESS] }
    val isLoggedIn: Flow<Boolean> = accessToken.map { !it.isNullOrBlank() }
    val displayName: Flow<String?> = context.dataStore.data.map { it[Keys.DISPLAY_NAME] }

    suspend fun currentAccessToken(): String? = context.dataStore.data.first()[Keys.ACCESS]
    suspend fun currentRefreshToken(): String? = context.dataStore.data.first()[Keys.REFRESH]

    suspend fun saveSession(userId: String, accessToken: String, refreshToken: String, displayName: String?) {
        context.dataStore.edit {
            it[Keys.USER_ID] = userId
            it[Keys.ACCESS] = accessToken
            it[Keys.REFRESH] = refreshToken
            if (displayName != null) it[Keys.DISPLAY_NAME] = displayName
        }
    }

    suspend fun updateTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit {
            it[Keys.ACCESS] = accessToken
            it[Keys.REFRESH] = refreshToken
        }
    }

    suspend fun clear() {
        context.dataStore.edit { it.clear() }
    }
}
