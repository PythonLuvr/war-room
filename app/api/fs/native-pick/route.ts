import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function nativePickWindows(initialPath: string, description: string): Promise<string | null> {
  // Show a real Windows folder dialog. Forces topmost so it doesn't hide behind the browser.
  const escDesc = description.replace(/'/g, "''");
  const escInit = initialPath.replace(/'/g, "''");
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Windows.Forms;
public class TopForm : Form { public TopForm() { this.TopMost = true; this.ShowInTaskbar = false; this.Opacity = 0; this.Size = new System.Drawing.Size(1,1); } }
"@ -ReferencedAssemblies System.Windows.Forms,System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$owner = New-Object TopForm
$owner.Show()
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = '${escDesc}'
$dlg.UseDescriptionForTitle = $true
$dlg.ShowNewFolderButton = $true
$dlg.SelectedPath = '${escInit}'
$result = $dlg.ShowDialog($owner)
$owner.Close()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dlg.SelectedPath }
`.trim();

  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-Command", ps],
      { windowsHide: true },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", () => resolve(null));
    child.on("close", () => {
      const picked = out.trim().split(/\r?\n/).pop()?.trim();
      if (!picked) {
        if (err.trim()) console.error("native folder pick:", err.trim());
        return resolve(null);
      }
      resolve(picked);
    });
  });
}

export async function POST(req: NextRequest) {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { ok: false, error: "native picker only wired for Windows; falling back" },
      { status: 501 },
    );
  }
  const { initialPath, description } = (await req.json().catch(() => ({}))) as {
    initialPath?: string;
    description?: string;
  };
  const start = initialPath?.trim() || os.homedir();
  const desc = description?.trim() || "Select a folder";
  const picked = await nativePickWindows(start, desc);
  if (!picked) return NextResponse.json({ ok: false, cancelled: true });
  return NextResponse.json({ ok: true, path: picked });
}
