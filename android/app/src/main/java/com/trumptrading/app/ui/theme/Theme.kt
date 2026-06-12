package com.trumptrading.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.trumptrading.app.data.model.RiskLevel

// Trading-terminal palette: near-black surfaces, restrained accents, risk colors.
object TradingColors {
    val Background = Color(0xFF0B0F14)
    val Surface = Color(0xFF121821)
    val SurfaceHigh = Color(0xFF1A2230)
    val Border = Color(0xFF243044)
    val TextPrimary = Color(0xFFE6EBF2)
    val TextSecondary = Color(0xFF8A97A8)
    val Accent = Color(0xFF3D8BFD)

    val Critical = Color(0xFFE53935)
    val High = Color(0xFFFB8C00)
    val Medium = Color(0xFFFDD835)
    val Low = Color(0xFF66BB6A)

    val PositiveSentiment = Color(0xFF66BB6A)
    val NegativeSentiment = Color(0xFFE53935)
}

fun riskColor(risk: RiskLevel): Color = when (risk) {
    RiskLevel.Critical -> TradingColors.Critical
    RiskLevel.High -> TradingColors.High
    RiskLevel.Medium -> TradingColors.Medium
    RiskLevel.Low -> TradingColors.Low
}

private val DarkScheme = darkColorScheme(
    primary = TradingColors.Accent,
    background = TradingColors.Background,
    surface = TradingColors.Surface,
    surfaceVariant = TradingColors.SurfaceHigh,
    onBackground = TradingColors.TextPrimary,
    onSurface = TradingColors.TextPrimary,
    onSurfaceVariant = TradingColors.TextSecondary,
    outline = TradingColors.Border,
    error = TradingColors.Critical,
)

private val AppTypography = Typography(
    headlineMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 26.sp, fontFamily = FontFamily.SansSerif),
    titleLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.5.sp),
)

@Composable
fun TrumpTradingTheme(content: @Composable () -> Unit) {
    // Always dark: trading dashboard look regardless of system setting.
    isSystemInDarkTheme()
    MaterialTheme(colorScheme = DarkScheme, typography = AppTypography, content = content)
}
