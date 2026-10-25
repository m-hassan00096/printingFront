import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnPath,
  hasAnyPermission,
  shouldResetSession,
} from "../src/features/auth/lib/auth-helpers.ts";
import { loginSchema } from "../src/features/auth/schemas/login.schema.ts";

test("safeReturnPath preserves legitimate protected destination and query", () => {
  assert.equal(safeReturnPath("/orders?page=2"), "/orders?page=2");
  assert.equal(safeReturnPath("/deliveries#ready"), "/deliveries#ready");
});

test("safeReturnPath rejects login loop, protocol-relative and external redirects", () => {
  for (const value of ["/login", "/login?redirect=x", "//attacker.example",
    "https://evil.example", "\\evil.example", null, undefined, 4]) {
    assert.equal(safeReturnPath(value), "/");
  }
});

test("hasAnyPermission only allows a listed backend permission", () => {
  assert.equal(hasAnyPermission(["orders.list"], ["orders.list", "finance.balances.view"]), true);
  assert.equal(hasAnyPermission(["orders.view"], ["orders.list"]), false);
  assert.equal(hasAnyPermission([], []), false);
  assert.equal(hasAnyPermission(undefined, ["orders.list"]), false);
});

test("only protected API 401 resets the active session", () => {
  assert.equal(shouldResetSession(401, "/orders"), true);
  assert.equal(shouldResetSession(401, "/auth/logout"), true);
  assert.equal(shouldResetSession(401, "/auth/me"), false);
  assert.equal(shouldResetSession(401, "/auth/login"), false);
  assert.equal(shouldResetSession(403, "/orders"), false);
  assert.equal(shouldResetSession(422, "/auth/login"), false);
  assert.equal(shouldResetSession(500, "/orders"), false);
});

test("login schema accepts valid values, trims username and never trims password", () => {
  const result = loginSchema.parse({ username: "  admin  ", password: " secret " });
  assert.deepEqual(result, { username: "admin", password: " secret " });
});

test("login validation rejects empty fields and excessive lengths", () => {
  assert.equal(loginSchema.safeParse({ username: "  ", password: "a" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "admin", password: "" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "a".repeat(256), password: "a" }).success, false);
});
