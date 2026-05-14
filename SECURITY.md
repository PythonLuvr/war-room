# Security Policy

## Supported versions

The latest released version on `main` is the only supported version. War Room is pre-1.0; older versions don't receive security backports.

## Reporting a vulnerability

If you find a security issue, **do not open a public GitHub issue.** Instead, report it privately:

- **Preferred:** GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repo (Security tab → "Report a vulnerability")
- **Fallback:** email the maintainer at `ejredd2007@gmail.com`

Please include:
- A description of the vulnerability
- Steps to reproduce, or a proof of concept
- The version / commit you tested against
- Any suggested mitigation

Expect an initial response within 72 hours. Coordinated disclosure preferred. If the issue is confirmed, a fix will land in a patch release and you'll be credited in the changelog unless you'd rather stay anonymous.

## Scope

In scope:
- The War Room application code in this repository
- Default configuration that ships with the repo
- The Electron wrapper (`electron/` directory)

Out of scope:
- Self-hosted infrastructure you configure yourself (your VPS, your LiveKit server, your Claude API key handling)
- The Claude Code CLI itself (report those to Anthropic)
- Dependencies (report upstream, but feel free to flag if a dep needs urgent pinning here)
- Issues that require physical access to the machine running War Room

## Threat model

War Room is designed to run on a trusted single-user localhost. It has no authentication. Anyone with access to `http://localhost:3000` on the machine has full app access. **Do not expose War Room to the public internet without putting an authenticating reverse proxy in front of it.**

That's by design for the solo-operator use case. A future hosted multi-user product will have its own auth and threat model.
