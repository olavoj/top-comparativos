import { describe, expect, it } from "vitest";
import {
  AutomationAuthError,
  canonicalAutomationMessage,
  sha256Hex,
  verifyAutomationRequest,
} from "@/lib/auth/automation";

const encoder = new TextEncoder();
const secret = "fixed-hosted-secret-for-automation-tests";
const sourceKey = "guia-potes";
const nowEpochSeconds = 1_722_780_000;

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function hex(bytesToEncode: Uint8Array): string {
  return Array.from(bytesToEncode, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes(message))));
}

async function signedHeaders(
  body: Uint8Array,
  overrides: Record<string, string> = {},
): Promise<Headers> {
  const bodyHash = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", body)));
  const timestamp = overrides["x-automation-timestamp"] ?? String(nowEpochSeconds);
  const requestId = overrides["x-automation-request-id"] ?? "req-123";
  const signedSourceKey = overrides.sourceKey ?? sourceKey;
  const message = `${timestamp}\n${requestId}\n${signedSourceKey}\n${bodyHash}`;
  const signature = overrides["x-automation-signature"] ?? (await sign(message));

  return new Headers({
    "x-automation-timestamp": timestamp,
    "x-automation-request-id": requestId,
    "x-automation-signature": signature,
    "x-automation-body-sha256": overrides["x-automation-body-sha256"] ?? bodyHash,
  });
}

function input(body: Uint8Array, headers: Headers, overrides = {}) {
  return {
    body,
    headers,
    sourceKey,
    nowEpochSeconds,
    bindings: { AUTOMATION_HMAC_SECRET: secret },
    ...overrides,
  };
}

function expectAuthError(error: unknown, code: string): boolean {
  expect(error).toBeInstanceOf(AutomationAuthError);
  expect((error as AutomationAuthError).code).toBe(code);
  expect(String(error)).not.toContain(secret);
  expect(String(error)).not.toContain("body-private-value");
  return true;
}

describe("automation request authentication", () => {
  it("hashes the exact raw body and canonicalizes the prescribed bytes", async () => {
    const body = bytes("body-private-value\n");
    const bodyHash = "b76f4e7214b9fdeccb01e7423da74298311fa33d1bee122dfd3a0e9d84390184";

    expect(await sha256Hex(body)).toBe(bodyHash);
    expect(
      canonicalAutomationMessage({
        timestamp: "1722780000",
        requestId: "req-123",
        sourceKey: "guia-potes",
        bodySha256: bodyHash,
      }),
    ).toBe(`1722780000\nreq-123\nguia-potes\n${bodyHash}`);
  });

  it("accepts an HMAC over the canonical raw request", async () => {
    const body = bytes("body-private-value");

    await expect(verifyAutomationRequest(input(body, await signedHeaders(body)))).resolves.toEqual({
      timestamp: nowEpochSeconds,
      requestId: "req-123",
      bodySha256: "ac79ee84310b735d4edbd57f353e2b482fefe1fac8dd2b9819b580bb28f6dfbd",
    });
  });

  it("rejects each missing required header without exposing request data", async () => {
    const body = bytes("body-private-value");
    for (const headerName of [
      "x-automation-timestamp",
      "x-automation-request-id",
      "x-automation-signature",
      "x-automation-body-sha256",
    ]) {
      const headers = await signedHeaders(body);
      headers.delete(headerName);

      await expect(verifyAutomationRequest(input(body, headers))).rejects.toSatisfy(
        (error: unknown) => expectAuthError(error, "missing_header"),
      );
    }
  });

  it("rejects duplicate signed headers", async () => {
    const body = bytes("body-private-value");
    const headers = await signedHeaders(body);
    headers.append("x-automation-request-id", "other-request");

    await expect(verifyAutomationRequest(input(body, headers))).rejects.toSatisfy(
      (error: unknown) => expectAuthError(error, "duplicate_header"),
    );
  });

  it("rejects uppercase or malformed body hashes", async () => {
    const body = bytes("body-private-value");
    const headers = await signedHeaders(body, {
      "x-automation-body-sha256": "B5C5300B032BF4305582621C1A944DA36DE2E2A2C67F33EBC84C4DFC8E442C0C",
    });

    await expect(verifyAutomationRequest(input(body, headers))).rejects.toSatisfy(
      (error: unknown) => expectAuthError(error, "invalid_body_sha256"),
    );
  });

  it("rejects signatures that do not have an HMAC-SHA256 byte length", async () => {
    const body = bytes("body-private-value");
    const headers = await signedHeaders(body, { "x-automation-signature": "00" });

    await expect(verifyAutomationRequest(input(body, headers))).rejects.toSatisfy(
      (error: unknown) => expectAuthError(error, "invalid_signature"),
    );
  });

  it("rejects a body whose bytes changed after signing", async () => {
    const signedBody = bytes("body-private-value");
    const headers = await signedHeaders(signedBody);

    await expect(
      verifyAutomationRequest(input(bytes("body-private-value!"), headers)),
    ).rejects.toSatisfy((error: unknown) => expectAuthError(error, "body_hash_mismatch"));
  });

  it("rejects a source key different from the signed source", async () => {
    const body = bytes("body-private-value");
    const headers = await signedHeaders(body);

    await expect(
      verifyAutomationRequest(input(body, headers, { sourceKey: "outro-guia" })),
    ).rejects.toSatisfy((error: unknown) => expectAuthError(error, "invalid_signature"));
  });

  it.each([nowEpochSeconds - 300, nowEpochSeconds + 300])(
    "accepts a timestamp exactly 300 seconds from now (%i)",
    async (timestamp) => {
      const body = bytes("body-private-value");
      const headers = await signedHeaders(body, {
        "x-automation-timestamp": String(timestamp),
      });

      await expect(verifyAutomationRequest(input(body, headers))).resolves.toMatchObject({
        timestamp,
      });
    },
  );

  it.each([nowEpochSeconds - 301, nowEpochSeconds + 301])(
    "rejects a timestamp outside the 300-second window (%i)",
    async (timestamp) => {
      const body = bytes("body-private-value");
      const headers = await signedHeaders(body, {
        "x-automation-timestamp": String(timestamp),
      });

      await expect(verifyAutomationRequest(input(body, headers))).rejects.toSatisfy(
        (error: unknown) => expectAuthError(error, "timestamp_out_of_range"),
      );
    },
  );

  it("fails closed when the hosted HMAC secret is missing", async () => {
    const body = bytes("body-private-value");

    await expect(
      verifyAutomationRequest(
        input(body, await signedHeaders(body), {
          bindings: {},
        }),
      ),
    ).rejects.toSatisfy((error: unknown) => expectAuthError(error, "missing_secret"));
  });
});
