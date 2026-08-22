import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "../../shared/db.js";

function encryptionKey(): Buffer {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET غير مُهيّأ");
  return crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest();
}

export function encryptGroqKey(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptGroqKey(value: string): string {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("مفتاح Groq المحفوظ غير صالح");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export async function getUserGroqKey(userId: string): Promise<string | null> {
  const [user] = await db.select({ groqApiKey: usersTable.groqApiKey }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.groqApiKey ? decryptGroqKey(user.groqApiKey) : null;
}