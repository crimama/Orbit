import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ENC_PREFIX = "enc:v1:";
let warnedMissingSecret = false;

function getSecretKey(): Buffer | null {
  const secret = process.env.SSH_PASSWORD_SECRET;
  if (!secret || !secret.trim()) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptSshPassword(password: string): string {
  const key = getSecretKey();
  if (!key) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.warn(
        "[SSH] SSH_PASSWORD_SECRET is not set. Storing SSH password as plain text.",
      );
    }
    // Backward-compatible fallback for local/dev setups without secret.
    return password;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSshPassword(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) {
    // Legacy plain-text value
    return value;
  }

  const key = getSecretKey();
  if (!key) {
    throw new Error("SSH_PASSWORD_SECRET is required to decrypt stored SSH passwords");
  }

  const payload = value.slice(ENC_PREFIX.length);
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Stored SSH password format is invalid");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

export function isEncryptedSshPassword(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}
