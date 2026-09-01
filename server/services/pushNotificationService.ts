// --- pushNotificationService.ts (patched) ---

import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "../../shared/db.js";
import { logger } from "../lib/logger.js"; // adjust path if different

let vapidConfigured = false;

export function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    // This is the missing piece: without this log, the failure is invisible.
    logger.error(
      {
        hasSubject: !!subject,
        hasPublicKey: !!publicKey,
        hasPrivateKey: !!privateKey,
      },
      "VAPID is not configured — push notifications are disabled"
    );
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// Expose a safe way for a route to check config + get the public key
export function getVapidPublicKey(): string | null {
  if (!configureVapid()) return null;
  return process.env.VAPID_PUBLIC_KEY!;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configureVapid()) return 0; // now at least logged above

  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  const expired: string[] = [];
  let sent = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload));
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        expired.push(subscription.id);
      } else {
        // Also log unexpected send failures — currently swallowed entirely.
        logger.error({ error, subscriptionId: subscription.id }, "Push send failed");
      }
    }
  }));

  if (expired.length > 0) {
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, expired));
  }
  return sent;
}

// --- new route to add in your notifications router ---
//
// router.get("/notifications/vapid-public-key", async (req, res): Promise<void> => {
//   const key = getVapidPublicKey();
//   if (!key) { res.status(503).json({ error: "Push notifications not configured" }); return; }
//   res.json({ publicKey: key });
// });
//
// Your frontend should call this BEFORE pushManager.subscribe(), and use the
// returned key (converted with urlBase64ToUint8Array) as applicationServerKey.