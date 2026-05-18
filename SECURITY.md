# Security Policy

## Reporting a vulnerability

If you've found a security issue in War Room, please report it through GitHub's private vulnerability reporting:

**[Report a vulnerability](https://github.com/PythonLuvr/war-room/security/advisories/new)**

This sends a private advisory visible only to repo maintainers. We'll acknowledge within a few days and coordinate disclosure once a fix is ready.

## Scope

In scope:
- Source code in this repository
- The reference sync server at `tools/reference-sync-server/`
- The LiveKit install script at `tools/install-livekit.sh`
- Bundled dependencies, if the issue is triggerable by War Room's usage

Out of scope:
- Issues in your own self-hosted deployment (your sync server, your VPS, your LiveKit keys). Those are operator responsibilities.
- Issues in upstream dependencies that don't affect War Room (report those upstream).
- Social engineering, physical attacks, denial of service against specific operators.

## Supported versions

Latest tagged release on the `main` branch only. Older releases are not patched.
