// "Manual VPS" hosting mode. The host is running their own sync
// server somewhere (per v0.15.0 SYNC.md), and the embedded server
// component is NOT being used in this mode. The adapter exists only
// to satisfy the dropdown contract and to surface the user-pasted
// URL back to the renderer via the standard status interface.
//
// Pre-set URL must be supplied by the host via the Settings panel.

import type {
  AdapterEvents,
  AdapterStartContext,
  AdapterStatus,
  TunnelAdapter,
} from "./types";

export class ManualAdapter implements TunnelAdapter {
  readonly mode = "manual" as const;
  private _status: AdapterStatus = { state: "idle" };
  private _url: string;

  constructor(url: string) {
    this._url = url;
  }

  async start(_ctx: AdapterStartContext, events: AdapterEvents): Promise<void> {
    if (!this._url) {
      this._status = { state: "error", message: "URL is required for Manual mode" };
      events.onStatus(this._status);
      return;
    }
    this._status = { state: "running", url: this._url };
    events.onStatus(this._status);
  }

  async stop(): Promise<void> {
    this._status = { state: "idle" };
  }

  status(): AdapterStatus {
    return this._status;
  }
}
