const textEncoder = new TextEncoder();
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const HMAC_SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^(0|[1-9][0-9]*)$/;
const MAX_TIMESTAMP_AGE_SECONDS = 300;

export type AutomationAuthErrorCode =
  | "missing_secret"
  | "missing_header"
  | "duplicate_header"
  | "invalid_timestamp"
  | "timestamp_out_of_range"
  | "invalid_body_sha256"
  | "body_hash_mismatch"
  | "invalid_signature";

export class AutomationAuthError extends Error {
  readonly code: AutomationAuthErrorCode;

  constructor(code: AutomationAuthErrorCode) {
    super(code);
    this.name = "AutomationAuthError";
    this.code = code;
  }
}

export interface AutomationBindings {
  AUTOMATION_HMAC_SECRET?: string;
}

export interface CanonicalAutomationMessageInput {
  timestamp: string;
  requestId: string;
  sourceKey: string;
  bodySha256: string;
}

export interface VerifyAutomationRequestInput {
  body: Uint8Array;
  headers: Headers;
  sourceKey: string;
  nowEpochSeconds?: number;
  bindings: AutomationBindings;
}

export interface VerifiedAutomationRequest {
  timestamp: number;
  requestId: string;
  bodySha256: string;
}

export async function sha256Hex(body: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", body)));
}

export function canonicalAutomationMessage(
  input: CanonicalAutomationMessageInput,
): string {
  return `${input.timestamp}\n${input.requestId}\n${input.sourceKey}\n${input.bodySha256}`;
}

export async function verifyAutomationRequest(
  input: VerifyAutomationRequestInput,
): Promise<VerifiedAutomationRequest> {
  const secret = input.bindings.AUTOMATION_HMAC_SECRET;
  if (!secret) {
    throw new AutomationAuthError("missing_secret");
  }

  const timestampValue = requiredHeader(input.headers, "x-automation-timestamp");
  const requestId = requiredHeader(input.headers, "x-automation-request-id");
  const signature = requiredHeader(input.headers, "x-automation-signature");
  const declaredBodySha256 = requiredHeader(
    input.headers,
    "x-automation-body-sha256",
  );

  if (!TIMESTAMP_PATTERN.test(timestampValue)) {
    throw new AutomationAuthError("invalid_timestamp");
  }
  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp)) {
    throw new AutomationAuthError("invalid_timestamp");
  }
  const nowEpochSeconds = input.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(nowEpochSeconds) ||
    Math.abs(nowEpochSeconds - timestamp) > MAX_TIMESTAMP_AGE_SECONDS
  ) {
    throw new AutomationAuthError("timestamp_out_of_range");
  }

  if (!SHA256_HEX_PATTERN.test(declaredBodySha256)) {
    throw new AutomationAuthError("invalid_body_sha256");
  }
  const bodySha256 = await sha256Hex(input.body);
  if (!constantTimeEqual(hexToBytes(declaredBodySha256), hexToBytes(bodySha256))) {
    throw new AutomationAuthError("body_hash_mismatch");
  }

  if (!HMAC_SIGNATURE_PATTERN.test(signature)) {
    throw new AutomationAuthError("invalid_signature");
  }
  const message = canonicalAutomationMessage({
    timestamp: timestampValue,
    requestId,
    sourceKey: input.sourceKey,
    bodySha256,
  });
  const expectedSignature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      textEncoder.encode(message),
    ),
  );

  if (!constantTimeEqual(hexToBytes(signature), expectedSignature)) {
    throw new AutomationAuthError("invalid_signature");
  }

  return { timestamp, requestId, bodySha256 };
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (value === null || value === "") {
    throw new AutomationAuthError("missing_header");
  }
  if (value.includes(",")) {
    throw new AutomationAuthError("duplicate_header");
  }
  return value;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function hexToBytes(value: string): Uint8Array {
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

function hex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
