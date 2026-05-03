import { vi, expect, beforeEach, describe, test } from "vitest";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const { createSession, getSession } = await import("@/lib/auth");

const SECRET = new TextEncoder().encode("development-secret-key");

async function signToken(
  payload: Record<string, unknown>,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(SECRET);
}

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-1", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, , options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });

  test("cookie value is a three-part JWT string", async () => {
    await createSession("user-1", "user@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("JWT is signed with HS256", async () => {
    await createSession("user-1", "user@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe("HS256");
  });

  test("JWT payload contains the provided userId and email", async () => {
    await createSession("user-42", "hello@example.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const payload = decodeJwt(token);
    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("hello@example.com");
  });

  test("cookie expiry is approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "user@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(
      before + sevenDaysMs - 1000
    );
    expect(options.expires.getTime()).toBeLessThanOrEqual(
      after + sevenDaysMs + 1000
    );
  });

  test("secure flag is false outside production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    await createSession("user-1", "user@example.com");
    process.env.NODE_ENV = original;

    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("secure flag is true in production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    await createSession("user-1", "user@example.com");
    process.env.NODE_ENV = original;

    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(true);
  });
});

describe("getSession", () => {
  beforeEach(() => vi.clearAllMocks());

  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await signToken(
      { userId: "u1", email: "a@b.com", expiresAt: new Date().toISOString() },
      "-1s"
    );
    mockCookieStore.get.mockReturnValue({ value: token });
    expect(await getSession()).toBeNull();
  });

  test("returns the session payload for a valid token", async () => {
    const token = await signToken({
      userId: "user-123",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("user@example.com");
  });

  test("reads the auth-token cookie by name", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await getSession();
    expect(mockCookieStore.get).toHaveBeenCalledWith("auth-token");
  });
});
