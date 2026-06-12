package com.trumptrading.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.trumptrading.app.data.repo.AuthRepository
import com.trumptrading.app.ui.components.DisclaimerFooter
import com.trumptrading.app.ui.nav.toDashboard
import com.trumptrading.app.ui.theme.TradingColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(private val auth: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    fun submit(isLogin: Boolean, email: String, password: String, displayName: String) {
        if (!email.contains('@')) { _state.value = AuthUiState(error = "Enter a valid email"); return }
        if (password.length < 8) { _state.value = AuthUiState(error = "Password must be at least 8 characters"); return }
        _state.value = AuthUiState(loading = true)
        viewModelScope.launch {
            runCatching {
                if (isLogin) auth.login(email, password) else auth.register(email, password, displayName)
            }.onSuccess {
                _state.value = AuthUiState(success = true)
            }.onFailure {
                _state.value = AuthUiState(error = it.message ?: "Authentication failed")
            }
        }
    }
}

@Composable
fun AuthScreen(nav: NavHostController, vm: AuthViewModel = hiltViewModel()) {
    val state by vm.state.collectAsState()
    var isLogin by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }

    LaunchedEffect(state.success) { if (state.success) nav.toDashboard() }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("TRUMP TRADING", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        Text("Real-time market-moving statement alerts", color = TradingColors.TextSecondary)
        Spacer(Modifier.height(32.dp))

        if (!isLogin) {
            OutlinedTextField(
                value = displayName, onValueChange = { displayName = it },
                label = { Text("Display name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("auth_name"),
            )
            Spacer(Modifier.height(12.dp))
        }
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().testTag("auth_email"),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth().testTag("auth_password"),
        )
        Spacer(Modifier.height(20.dp))

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("auth_error"))
            Spacer(Modifier.height(12.dp))
        }

        Button(
            onClick = { vm.submit(isLogin, email.trim(), password, displayName.trim()) },
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth().testTag("auth_submit"),
        ) {
            if (state.loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
            else Text(if (isLogin) "Log in" else "Create account")
        }
        TextButton(onClick = { isLogin = !isLogin }) {
            Text(if (isLogin) "New here? Create an account" else "Already registered? Log in")
        }
        Spacer(Modifier.height(24.dp))
        DisclaimerFooter()
    }
}
