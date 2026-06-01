import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("issue #8 icon-only buttons have explicit aria-labels", () => {
  const channelHeader = read("components/channel-header.tsx");
  assert.match(channelHeader, /title=\{title\}\s+aria-label=\{title\}/, "channel header icon buttons should reuse title as aria-label");

  const rail = read("components/rail.tsx");
  for (const label of [
    'aria-label="Create server"',
    'aria-label="Invite teammates"',
    'aria-label="Sync status"',
    'aria-label="Settings"',
    'aria-label={`Open ${server.name} server`}',
    'aria-label="Close create server dialog"',
    'aria-label="Close edit server dialog"',
    'aria-label={`Set server color to ${c}`}',
  ]) {
    assert.ok(rail.includes(label), `rail is missing ${label}`);
  }

  const channelList = read("components/channel-list.tsx");
  for (const label of [
    'aria-label={`Create channel in ${g.label}`}',
    'aria-label={`Delete category "${g.label}"`}',
    'aria-label="Cancel new category"',
    'aria-label="Channel options"',
  ]) {
    assert.ok(channelList.includes(label), `channel list is missing ${label}`);
  }

  const settingsModal = read("components/settings-modal.tsx");
  for (const label of [
    'aria-label="Close settings"',
    'aria-label="Use built-in logo"',
    'aria-label={`Use ${p.label} logo`}',
    'aria-label={`Use ${opt.label} accent color`}',
  ]) {
    assert.ok(settingsModal.includes(label), `settings modal is missing ${label}`);
  }
});
