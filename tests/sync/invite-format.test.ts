// Round-trip and smart-paste tests for the invite block format.
// Run via: npm run test:invite (chained from npm run test).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatInvite,
  parseInvite,
  looksLikeInvite,
  INVITE_HEADER,
} from "../../lib/sync/invite-format";

const SAMPLE = {
  url: "https://gentle-piano-prairie.trycloudflare.com",
  workspace: "my-team",
  token: "x9k4abc123def456",
};

test("format includes the invite header line", () => {
  const text = formatInvite(SAMPLE);
  assert.ok(text.startsWith(INVITE_HEADER));
});

test("format + parse round-trip recovers all three fields", () => {
  const text = formatInvite(SAMPLE);
  const parsed = parseInvite(text);
  assert.deepEqual(parsed, SAMPLE);
});

test("parse handles Windows CRLF line endings from cross-OS clipboards", () => {
  const text = formatInvite(SAMPLE).replace(/\n/g, "\r\n");
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse handles old Mac CR line endings", () => {
  const text = formatInvite(SAMPLE).replace(/\n/g, "\r");
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse is case-insensitive on field names", () => {
  const text = `url: ${SAMPLE.url}\nworkspace: ${SAMPLE.workspace}\ntoken: ${SAMPLE.token}`;
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse tolerates extra leading and trailing whitespace per line", () => {
  const text = `   URL:    ${SAMPLE.url}   \n  Workspace:   ${SAMPLE.workspace}\nToken: ${SAMPLE.token}  `;
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse tolerates fields in any order", () => {
  const text = `Token: ${SAMPLE.token}\nURL: ${SAMPLE.url}\nWorkspace: ${SAMPLE.workspace}`;
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse ignores surrounding chatter (Slack quote markers, signatures)", () => {
  const text = [
    "> Hey team, here's the War Room invite:",
    ">",
    `> URL: ${SAMPLE.url}`,
    `> Workspace: ${SAMPLE.workspace}`,
    `> Token: ${SAMPLE.token}`,
    ">",
    "> Let me know if it doesn't work.",
    "> - EJ",
  ].join("\n");
  assert.deepEqual(parseInvite(text), SAMPLE);
});

test("parse returns null when any field is missing", () => {
  const missing_url = `Workspace: ${SAMPLE.workspace}\nToken: ${SAMPLE.token}`;
  const missing_workspace = `URL: ${SAMPLE.url}\nToken: ${SAMPLE.token}`;
  const missing_token = `URL: ${SAMPLE.url}\nWorkspace: ${SAMPLE.workspace}`;
  assert.equal(parseInvite(missing_url), null);
  assert.equal(parseInvite(missing_workspace), null);
  assert.equal(parseInvite(missing_token), null);
});

test("parse returns null on empty / whitespace input", () => {
  assert.equal(parseInvite(""), null);
  assert.equal(parseInvite("   \n\n   "), null);
});

test("parse returns null on input with no labeled fields", () => {
  assert.equal(parseInvite("just some random text\nwith no fields"), null);
});

test("looksLikeInvite recognizes formatted blocks via header", () => {
  assert.equal(looksLikeInvite(formatInvite(SAMPLE)), true);
});

test("looksLikeInvite recognizes header-less but parseable blocks", () => {
  const headerless = `URL: ${SAMPLE.url}\nWorkspace: ${SAMPLE.workspace}\nToken: ${SAMPLE.token}`;
  assert.equal(looksLikeInvite(headerless), true);
});

test("looksLikeInvite rejects plain non-invite text", () => {
  assert.equal(looksLikeInvite("hello world"), false);
  assert.equal(looksLikeInvite(""), false);
});

test("workspace with spaces still parses cleanly", () => {
  const sample = { ...SAMPLE, workspace: "design ops team" };
  assert.deepEqual(parseInvite(formatInvite(sample)), sample);
});

test("token with mixed case + hex parses cleanly", () => {
  const sample = { ...SAMPLE, token: "AbC123xYz789" };
  assert.deepEqual(parseInvite(formatInvite(sample)), sample);
});
