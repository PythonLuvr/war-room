# Multiplayer hosting

War Room is local-first. You don't need any of this if you're using
it solo. Multiplayer means one teammate runs the sync server and
everyone else connects to it.

Settings -> Sync gives you four ways to host. Pick one. Click "Host
this workspace from this machine." Copy the invite. Paste it in
Slack. Done.

## Which mode do I pick?

| Mode | When | URL stays the same? | Cost | Account |
|---|---|---|---|---|
| Share over the internet (instant) | Trying it out, demo, daily use if you don't mind re-sharing on restart | No, changes every restart | Free | None |
| Share over the internet (permanent URL) | Long-running team setup | Yes | About $10/year for a domain | Free Cloudflare account |
| Share over private network | You want zero exposure to the public internet | Yes (per device) | Free up to 3 teammates including you | Tailscale account |
| Connect to my own server | You already deployed `tools/reference-sync-server/` on a VPS | Yes | Whatever your VPS costs | Whatever your VPS provider needs |

## "Share over the internet (instant)" - Cloudflare Quick Tunnel

The fastest way in. On first activation, War Room downloads the
cloudflared binary (~50 MB) from Cloudflare's official releases,
verifies the SHA256, and caches it. Subsequent runs reuse the cache.

Then it runs `cloudflared tunnel --url http://127.0.0.1:<port>` and
parses the public `https://*.trycloudflare.com` URL out of the
output. That URL goes into the invite block, you copy it, you paste
it, your teammates connect.

**The URL changes on every restart.** This is the trade Quick Tunnel
makes for not needing a Cloudflare account or domain. War Room
detects when the new URL is different from the one you last copied
and shows a banner: "Your tunnel URL changed. The old invite no
longer works. [Copy new invite]" - click that, paste in Slack again.

## "Share over the internet (permanent URL)" - Cloudflare Named Tunnel

Same plumbing but stable. Steps:

1. Sign up for a free Cloudflare account.
2. Buy a domain (about $10/year via any registrar; Cloudflare also
   sells them at-cost).
3. Add the domain to Cloudflare's DNS.
4. In the Cloudflare Zero Trust dashboard, create a tunnel. Cloudflare
   gives you a tunnel token.
5. In the tunnel's public hostname config, point a subdomain (like
   `war-room.your-domain.com`) at `http://localhost:<port>` where
   `<port>` is the port shown in War Room's hosting status panel.
6. Paste the tunnel token + the subdomain URL into War Room's
   Settings -> Sync -> "Cloudflare Named Tunnel config".
7. Click Host.

URL stays the same across restarts and reboots.

## "Share over private network" - Tailscale

If you don't want anything publicly reachable. Steps:

1. Install Tailscale from tailscale.com on every machine that needs to
   participate (the host AND each teammate).
2. Sign in to the same tailnet on every machine.
3. In War Room, pick the Tailscale mode and click Host.
4. War Room detects your Tailscale IP and shows
   `ws://100.x.y.z:<port>/` as the URL. Share that with teammates.

**Free for up to 3 teammates including you.** Above that, you pay
Tailscale's subscription. The notice is always visible while
Tailscale is the selected mode.

## "Connect to my own server" - Manual VPS

The v0.15.0 path. You deployed `tools/reference-sync-server/` on a
VPS yourself and want War Room to point at it. Paste the URL, paste
your token, click Save.

## Smart-paste on the join side

Teammates don't have to copy/paste three fields. The Settings -> Sync
Connect form's URL field has smart-paste: paste the whole invite
block into it and all three fields auto-fill. Works from Slack,
Discord, email, even with quote-marker `>` prefixes.

## Single-host discipline

Only one teammate hosts at a time per workspace. The app can't
physically prevent two of you from both clicking Host - what it can
do is show a persistent indicator in the top-left of every screen:
"Hosting <workspace>". If you see that on your screen, you're the
source of truth. If two teammates see it, you've split-brained the
workspace - one of you should Stop Hosting.

## Rotating the token

Settings -> Sync -> Hosting -> Rotate token.

This invalidates the current invite. A new token is generated, the
invite block updates, and the tunnel restarts. You re-share the new
invite. Teammates see a "connection rejected" message until they
re-paste the new invite block.

## Auto-resume

If hosting was on when you quit War Room, it comes back up on next
launch automatically. The chrome indicator shows. If the URL is
different from the one you last copied (common with Quick Tunnel),
the URL-changed banner shows in Settings.

To stop hosting permanently, click Stop Hosting in Settings -> Sync.

## What still doesn't sync

Per v0.15.0 limits, also covered in `SYNC.md`:

- Chat messages stay per-user.
- Uploaded file bytes stay on the machine that uploaded them. URLs
  travel with their row; content does not.

These are explicit follow-up work, not bugs.

## Windows SmartScreen

First time cloudflared.exe spawns on Windows, you may see a SmartScreen
prompt about a downloaded executable. The binary is Cloudflare's
official signed release; War Room verifies the SHA256 before running
it. Click "More info" then "Run anyway" once and SmartScreen
remembers.
