# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class com.trumptrading.app.data.model.** { *** Companion; }
-keepclasseswithmembers class com.trumptrading.app.data.model.** { kotlinx.serialization.KSerializer serializer(...); }
# Retrofit
-keepattributes Signature, Exceptions
-dontwarn okhttp3.**
-dontwarn retrofit2.**
