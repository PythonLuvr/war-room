import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type CatalogAgent = {
  id: string;
  name: string;
  description: string;
  model?: string;
};

function parseYamlFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    if (key && value) result[key] = value;
  }
  return result;
}

export async function GET() {
  const agentsDir = path.join(os.homedir(), ".claude", "agents");
  if (!fs.existsSync(agentsDir)) {
    return NextResponse.json({ agents: [] });
  }

  const agents: CatalogAgent[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(agentsDir);
  } catch {
    return NextResponse.json({ agents: [] });
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(agentsDir, entry);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const fm = parseYamlFrontmatter(content);
    const id = fm.name ?? entry.replace(/\.md$/, "");
    const description = fm.description
      ? fm.description.slice(0, 120) + (fm.description.length > 120 ? "…" : "")
      : "";
    agents.push({ id, name: id, description, model: fm.model });
  }

  agents.sort((a, b) => a.id.localeCompare(b.id));
  return NextResponse.json({ agents });
}
