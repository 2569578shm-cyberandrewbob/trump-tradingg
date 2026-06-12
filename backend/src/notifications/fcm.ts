import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import { env } from '../config/env.js';

let messaging: admin.messaging.Messaging | null = null;

if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const serviceAccount = JSON.parse(readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  messaging = admin.messaging();
}

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>; // alertId, riskLevel, categories, sourceUrl, detectedAt...
}

/** Send to a set of device tokens. Returns tokens that are dead and should be pruned. */
export async function sendPush(tokens: string[], payload: PushPayload): Promise<string[]> {
  if (!messaging || tokens.length === 0) return [];
  const res = await messaging.sendEachForMulticast({
    tokens,
    data: payload.data,
    notification: { title: payload.title, body: payload.body },
    android: {
      priority: 'high',
      notification: {
        channelId: `risk_${(payload.data.riskLevel ?? 'low').toLowerCase()}`,
        sound: 'default',
      },
    },
  });
  const dead: string[] = [];
  res.responses.forEach((r, i) => {
    if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']
        .includes(r.error?.code ?? '')) {
      dead.push(tokens[i]);
    }
  });
  return dead;
}
