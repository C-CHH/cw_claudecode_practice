// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookieStore = { set: mockCookieSet, get: mockCookieGet, delete: mockCookieDelete };
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const TEST_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(payload: Record<string, unknown>, secret = TEST_SECRET) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secret);
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly cookie named auth-token", async () => {
  await createSession("user-123", "user@example.com");

  expect(mockCookieSet).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieSet.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
});

test("createSession cookie expires in approximately 7 days", async () => {
  const before = Date.now();
  await createSession("user-123", "user@example.com");
  const after = Date.now();

  const [, , options] = mockCookieSet.mock.calls[0];
  const expiresMs = options.expires.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs);
});

test("createSession stores a valid JWT containing userId and email", async () => {
  await createSession("user-456", "test@example.com");

  const [, token] = mockCookieSet.mock.calls[0];
  const secret = new TextEncoder().encode("development-secret-key");
  const { payload } = await jwtVerify(token, secret);

  expect(payload.userId).toBe("user-456");
  expect(payload.email).toBe("test@example.com");
});

test("createSession JWT uses HS256 algorithm", async () => {
  await createSession("user-123", "user@example.com");

  const [, token] = mockCookieSet.mock.calls[0];
  const [headerB64] = token.split(".");
  const header = JSON.parse(atob(headerB64));

  expect(header.alg).toBe("HS256");
});

test("createSession sets sameSite to lax and path to /", async () => {
  await createSession("user-123", "user@example.com");

  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession sets secure based on NODE_ENV", async () => {
  const original = process.env.NODE_ENV;

  process.env.NODE_ENV = "production";
  await createSession("user-123", "user@example.com");
  const [, , productionOptions] = mockCookieSet.mock.calls[0];
  expect(productionOptions.secure).toBe(true);

  vi.clearAllMocks();

  process.env.NODE_ENV = "test";
  await createSession("user-123", "user@example.com");
  const [, , testOptions] = mockCookieSet.mock.calls[0];
  expect(testOptions.secure).toBe(false);

  process.env.NODE_ENV = original;
});

test("createSession works with different userId and email values", async () => {
  await createSession("admin-999", "admin@corp.io");

  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, TEST_SECRET);

  expect(payload.userId).toBe("admin-999");
  expect(payload.email).toBe("admin@corp.io");
});

// getSession tests

test("getSession returns null when no cookie is set", async () => {
  mockCookieGet.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns the session payload for a valid token", async () => {
  const token = await makeToken({ userId: "user-123", email: "user@example.com" });
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("user@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieGet.mockReturnValue({ value: "not.a.jwt" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for a token signed with the wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await makeToken({ userId: "user-123", email: "user@example.com" }, wrongSecret);
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const token = await new SignJWT({ userId: "user-123", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-1s")
    .setIssuedAt()
    .sign(TEST_SECRET);
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession reads from the auth-token cookie", async () => {
  mockCookieGet.mockReturnValue(undefined);

  await getSession();

  expect(mockCookieGet).toHaveBeenCalledWith("auth-token");
});

// createSession — additional coverage

test("createSession JWT payload includes expiresAt approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("user-123", "user@example.com");
  const after = Date.now();

  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, TEST_SECRET);

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(payload.expiresAt as string).getTime();

  expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs);
  expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs);
});

test("createSession JWT has an issuedAt claim", async () => {
  const before = Math.floor(Date.now() / 1000);
  await createSession("user-123", "user@example.com");
  const after = Math.floor(Date.now() / 1000);

  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, TEST_SECRET);

  expect(payload.iat).toBeGreaterThanOrEqual(before);
  expect(payload.iat).toBeLessThanOrEqual(after);
});

test("createSession handles email addresses with special characters", async () => {
  await createSession("user-789", "user+tag@sub.example.com");

  const [, token] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, TEST_SECRET);

  expect(payload.email).toBe("user+tag@sub.example.com");
});

test("createSession cookie expiry and JWT expiresAt are consistent", async () => {
  await createSession("user-123", "user@example.com");

  const [, token, options] = mockCookieSet.mock.calls[0];
  const { payload } = await jwtVerify(token, TEST_SECRET);

  const cookieExpiry = options.expires.getTime();
  const payloadExpiry = new Date(payload.expiresAt as string).getTime();

  expect(Math.abs(cookieExpiry - payloadExpiry)).toBeLessThan(1000);
});

// deleteSession

test("deleteSession deletes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieDelete).toHaveBeenCalledOnce();
  expect(mockCookieDelete).toHaveBeenCalledWith("auth-token");
});

test("deleteSession does not set or read any cookie", async () => {
  await deleteSession();

  expect(mockCookieSet).not.toHaveBeenCalled();
  expect(mockCookieGet).not.toHaveBeenCalled();
});

// verifySession

test("verifySession returns null when the request has no auth-token cookie", async () => {
  const request = new NextRequest("http://localhost/");

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns session payload for a valid token", async () => {
  const token = await makeToken({ userId: "user-123", email: "user@example.com" });
  const request = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(request);

  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("user@example.com");
});

test("verifySession returns null for a malformed token", async () => {
  const request = new NextRequest("http://localhost/", {
    headers: { cookie: "auth-token=not.a.valid.jwt" },
  });

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns null for a token signed with the wrong secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await makeToken({ userId: "user-123", email: "user@example.com" }, wrongSecret);
  const request = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(request);

  expect(session).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const token = await new SignJWT({ userId: "user-123", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("-1s")
    .setIssuedAt()
    .sign(TEST_SECRET);
  const request = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });

  const session = await verifySession(request);

  expect(session).toBeNull();
});

// getSession — additional edge cases

test("getSession returns null when cookie value is an empty string", async () => {
  mockCookieGet.mockReturnValue({ value: "" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns a payload with userId, email, and expiresAt fields", async () => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await makeToken({
    userId: "user-123",
    email: "user@example.com",
    expiresAt: expiresAt.toISOString(),
  });
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("user@example.com");
  expect(session?.expiresAt).toBeDefined();
});

test("getSession returns null for a token with a not-before claim in the future", async () => {
  const futureNbf = Math.floor(Date.now() / 1000) + 3600;
  const token = await new SignJWT({ userId: "user-123", email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setNotBefore(futureNbf)
    .setIssuedAt()
    .sign(TEST_SECRET);
  mockCookieGet.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});
