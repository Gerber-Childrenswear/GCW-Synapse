import test from "node:test";
import assert from "node:assert/strict";
import { resolveSearchTerm } from "./searchTerm";

test("resolveSearchTerm finds first matching default key", () => {
  const params = new URLSearchParams("q=footie&query=ignored");
  const term = resolveSearchTerm(params);
  assert.equal(term, "footie");
});

test("resolveSearchTerm supports custom key order", () => {
  const params = new URLSearchParams("keyword=romper");
  const term = resolveSearchTerm(params, ["keyword"]);
  assert.equal(term, "romper");
});

test("resolveSearchTerm returns undefined for empty values", () => {
  const params = new URLSearchParams("q=   ");
  const term = resolveSearchTerm(params);
  assert.equal(term, undefined);
});
