// @vitest-environment node
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(
  payload: Record<string, unknown>,
  exp: string | number = "7d"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(SECRET);
}

function makeCookieStore(tokenValue?: string) {
  return {
    get: vi.fn((name: string) =>
      name === COOKIE_NAME && tokenValue ? { name, value: tokenValue } : undefined
    ),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

beforeEach(() => {
  vi.mocked(cookies).mockResolvedValue(makeCookieStore() as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- createSession ---

test("createSession sets auth-token cookie", async () => {
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  expect(store.set).toHaveBeenCalledOnce();
  expect(store.set.mock.calls[0][0]).toBe(COOKIE_NAME);
});

test("createSession cookie is httpOnly with correct sameSite and path", async () => {
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  const options = store.set.mock.calls[0][2];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession token contains userId and email", async () => {
  const { jwtVerify } = await import("jose");
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  const token = store.set.mock.calls[0][1];
  const { payload } = await jwtVerify(token, SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("createSession cookie expires in approximately 7 days", async () => {
  const before = Date.now();
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  const options = store.set.mock.calls[0][2];
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const diff = (options.expires as Date).getTime() - before;
  expect(diff).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
  expect(diff).toBeLessThanOrEqual(sevenDaysMs + 1000);
});

test("createSession cookie is not secure in development", async () => {
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  const options = store.set.mock.calls[0][2];
  expect(options.secure).toBe(false);
});

test("createSession cookie is secure in production", async () => {
  vi.stubEnv("NODE_ENV", "production");

  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await createSession("user-1", "user@example.com");

  const options = store.set.mock.calls[0][2];
  expect(options.secure).toBe(true);

  vi.unstubAllEnvs();
});

// --- getSession ---

test("getSession returns null when no cookie", async () => {
  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns session payload for valid token", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" });
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(token) as any);

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for expired token", async () => {
  const expiredAt = Math.floor(Date.now() / 1000) - 1;
  const token = await makeToken({ userId: "user-1", email: "user@example.com" }, expiredAt);
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(token) as any);

  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns null for tampered token", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" });
  const tampered = token.slice(0, -6) + "XXXXXX";
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(tampered) as any);

  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns null for token signed with wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user-1", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(wrongSecret);
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(token) as any);

  const result = await getSession();
  expect(result).toBeNull();
});

test("getSession returns all session fields", async () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await makeToken({ userId: "user-1", email: "user@example.com", expiresAt });
  vi.mocked(cookies).mockResolvedValue(makeCookieStore(token) as any);

  const session = await getSession();
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
  expect(session?.expiresAt).toBeDefined();
});

// --- deleteSession ---

test("deleteSession removes auth-token cookie", async () => {
  const store = makeCookieStore();
  vi.mocked(cookies).mockResolvedValue(store as any);

  await deleteSession();

  expect(store.delete).toHaveBeenCalledOnce();
  expect(store.delete).toHaveBeenCalledWith(COOKIE_NAME);
});

// --- verifySession ---

test("verifySession returns null when request has no cookie", async () => {
  const request = new NextRequest("http://localhost/api/test");
  const result = await verifySession(request);
  expect(result).toBeNull();
});

test("verifySession returns session payload for valid cookie", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" });
  const request = new NextRequest("http://localhost/api/test", {
    headers: { cookie: `${COOKIE_NAME}=${token}` },
  });

  const session = await verifySession(request);
  expect(session?.userId).toBe("user-1");
  expect(session?.email).toBe("user@example.com");
});

test("verifySession returns null for tampered cookie", async () => {
  const token = await makeToken({ userId: "user-1", email: "user@example.com" });
  const tampered = token.slice(0, -6) + "XXXXXX";
  const request = new NextRequest("http://localhost/api/test", {
    headers: { cookie: `${COOKIE_NAME}=${tampered}` },
  });

  const result = await verifySession(request);
  expect(result).toBeNull();
});
