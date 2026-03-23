const ENCRYPTED_VALUE_VERSION = 1;

type DestinationEncryptionEnv = CloudflareEnv & {
  DESTINATION_ENCRYPTION_KEY?: string;
};

type EncryptedValueEnvelope = {
  alg: "AES-GCM";
  ciphertext: string;
  iv: string;
  keyVersion: number;
  type: "encrypted";
};

function encodeBase64(value: Uint8Array): string {
  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function getEncryptionSecret(env?: DestinationEncryptionEnv): string | null {
  return (
    env?.DESTINATION_ENCRYPTION_KEY ||
    env?.AUTH_SECRET ||
    process.env.DESTINATION_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    null
  );
}

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret);
  const keyMaterial = await crypto.subtle.digest("SHA-256", secretBytes);

  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function parseEncryptedValue(value: string): EncryptedValueEnvelope | null {
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedValueEnvelope>;

    if (
      parsed.type !== "encrypted" ||
      parsed.alg !== "AES-GCM" ||
      typeof parsed.iv !== "string" ||
      typeof parsed.ciphertext !== "string"
    ) {
      return null;
    }

    return {
      type: "encrypted",
      alg: "AES-GCM",
      iv: parsed.iv,
      ciphertext: parsed.ciphertext,
      keyVersion: typeof parsed.keyVersion === "number" ? parsed.keyVersion : ENCRYPTED_VALUE_VERSION,
    };
  } catch {
    return null;
  }
}

export async function encryptValue(value: string, env?: DestinationEncryptionEnv): Promise<string> {
  const secret = getEncryptionSecret(env);

  if (!secret) {
    throw new Error("Destination encryption secret is not configured");
  }

  const key = await deriveEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return JSON.stringify({
    type: "encrypted",
    alg: "AES-GCM",
    keyVersion: ENCRYPTED_VALUE_VERSION,
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  } satisfies EncryptedValueEnvelope);
}

export async function decryptValue(
  value: string | null | undefined,
  env?: DestinationEncryptionEnv
): Promise<string | null> {
  if (!value) {
    return value ?? null;
  }

  const envelope = parseEncryptedValue(value);
  if (!envelope) {
    return value;
  }

  const secret = getEncryptionSecret(env);
  if (!secret) {
    throw new Error("Destination encryption secret is not configured");
  }

  const key = await deriveEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(envelope.iv) },
    key,
    decodeBase64(envelope.ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}
