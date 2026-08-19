import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "../../shared/db.js";

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
}

/** Sends to all active browser sessions for a user and removes expired endpoints. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configureVapid()) return 0;

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
      if (error?.statusCode === 404 || error?.statusCode === 410) expired.push(subscription.id);
    }
  }));

  if (expired.length > 0) {
    await db.delete(pushSubscriptionsTable).where(inArray(pushSubscriptionsTable.id, expired));
  }
  return sent;
}