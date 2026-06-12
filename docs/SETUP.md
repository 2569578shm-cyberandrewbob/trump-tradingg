# Setup Guide

## 1. Backend (local)

Prerequisites: Node.js 22+, PostgreSQL 15+, Redis 7+.

```bash
cd backend
npm install
cp .env.example .env          # then edit values
createdb trump_trading        # or create via pgAdmin / Supabase
npm run migrate               # applies migrations/*.sql
npm run seed                  # sources, demo users, demo alert
npm run dev                   # API on :8080
```

Run the workers in separate terminals (each is an independent process):

```bash
npm run worker:ingest    # polls enabled sources, dedupes, stores raw statements
npm run worker:analyze   # AI analysis -> processed alerts
npm run worker:notify    # FCM dispatch
```

Seeded accounts: `admin@trumptrading.app` / `Admin123!` (admin) and `demo@trumptrading.app` / `Demo123!`. **Change these immediately.**

### Using Supabase instead of local Postgres
Set `DATABASE_URL` to your Supabase connection string (Settings → Database → Connection string, use the *session pooler* URI). Run `npm run migrate` the same way.

### Anthropic AI analysis
Set `ANTHROPIC_API_KEY` (console.anthropic.com). Without it, the system automatically uses the conservative rule-based classifier (risk capped at High, summaries labeled as keyword-based).

## 2. Firebase Cloud Messaging

1. Create a Firebase project at console.firebase.google.com.
2. Add an Android app with package `com.trumptrading.app`; download `google-services.json` and **replace the placeholder** at `android/app/google-services.json`.
3. Project settings → Service accounts → Generate new private key. Save the JSON as `backend/firebase-service-account.json` (gitignored) and set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.

## 3. Android app

1. Open `android/` in Android Studio (Ladybug or newer, JDK 17). The Gradle wrapper is not committed — Android Studio generates it on first sync (or run `gradle wrapper --gradle-version 8.10` once); after that the `./gradlew` commands below work.
2. Replace the placeholder `google-services.json` (step 2 above).
3. The debug build points at `http://10.0.2.2:8080/` (host machine from the emulator). For a physical device, change `API_BASE_URL` in `app/build.gradle.kts` to your machine's LAN IP or a deployed backend (HTTPS required in release — cleartext is disabled).
4. Run ▶ on an emulator/device (minSdk 26).

### Build a debug APK
```bash
cd android
./gradlew assembleDebug        # output: app/build/outputs/apk/debug/app-debug.apk
```

### Build a signed release AAB
1. Create a keystore:
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias trumptrading -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add to `~/.gradle/gradle.properties` (never commit):
   ```
   TT_STORE_FILE=/abs/path/release.keystore
   TT_STORE_PASSWORD=...
   TT_KEY_ALIAS=trumptrading
   TT_KEY_PASSWORD=...
   ```
3. Add a `signingConfigs` block referencing those properties in `app/build.gradle.kts`, set `release.signingConfig`, then:
   ```bash
   ./gradlew bundleRelease      # output: app/build/outputs/bundle/release/app-release.aab
   ```

## 4. Running tests

```bash
# Backend unit tests (no services needed)
cd backend && npm test

# Backend API integration tests (need migrated Postgres + Redis)
RUN_API_TESTS=1 npm test

# Android unit tests
cd android && ./gradlew testDebugUnitTest

# Android UI tests (emulator/device required)
./gradlew connectedDebugAndroidTest
```
