import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProviderDriverRegistry, supportsKind } from "../index.ts";

Deno.test("ProviderDriverRegistry resolves Hermes and DBSync", () => {
  const hermes = ProviderDriverRegistry.resolve("HERMES_PARDINI");
  const dbsync = ProviderDriverRegistry.resolve("DB_DIAGNOSTICOS");
  assertExists(hermes);
  assertExists(dbsync);
  assertEquals(hermes!.provider, "HERMES_PARDINI");
  assertEquals(dbsync!.provider, "DB_DIAGNOSTICOS");
});

Deno.test("Unknown provider resolves to null", () => {
  assertEquals(ProviderDriverRegistry.resolve("UNKNOWN_X"), null);
});

Deno.test("Capabilities supportsKind matrix", () => {
  const dbsync = ProviderDriverRegistry.resolve("DB_DIAGNOSTICOS")!;
  assertEquals(supportsKind(dbsync.capabilities, "FETCH_LABEL"), true);
  const hermes = ProviderDriverRegistry.resolve("HERMES_PARDINI")!;
  assertEquals(supportsKind(hermes.capabilities, "FETCH_LABEL"), false);
  assertEquals(supportsKind(hermes.capabilities, "POLL_RESULT"), true);
});
