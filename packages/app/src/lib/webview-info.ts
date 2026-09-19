/**
 * Web-engine detection for the desktop app (Settings → About). The parsing
 * itself lives in core (packages/core/src/utils/webview-info.ts) so the mobile
 * app can parse the reader WebView's UA with identical results; this wrapper
 * adds the Tauri-runtime check and the runtime version query.
 *
 * The VERSION comes from the Tauri runtime (`tauri::webview_version()`):
 * the User-Agent is reduced to a stub on Windows WebView2 (UA Reduction,
 * e.g. Edg/152.0.0.0 on a 152.0.4191.62 runtime) and carries frozen fallback
 * tokens for the WebKit engines, while the runtime query returns the real
 * build on every desktop platform. Only the ENGINE label stays with the UA
 * parse — the runtime query has no brand.
 *
 * Version floors differ per engine (e.g. :has() needs WebView2 ≥ 105 /
 * WebKitGTK ≥ 2.36), which is exactly why the exact build matters. Detection
 * is display-only diagnostics, not a security boundary.
 */

import { invoke } from "@tauri-apps/api/core";
import { formatWebviewInfo, parseWebviewInfo } from "@readany/core/utils/webview-info";
import type { WebviewInfo } from "@readany/core/utils/webview-info";

/** True when running inside a Tauri webview (vs. plain `vite` dev in a browser). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getWebviewInfo(ua: string = navigator.userAgent): WebviewInfo {
  return parseWebviewInfo(ua, isTauriRuntime());
}

/**
 * Display label for Settings → About, async because the real build number
 * needs a round-trip to the Rust runtime. Falls back to the UA-parsed version
 * (reduced on WebView2) when the query is unavailable — plain `vite` dev in a
 * browser, or a failed command.
 */
export async function getWebviewLabel(): Promise<string> {
  const { engine, version } = getWebviewInfo();
  if (!engine) return "";
  if (isTauriRuntime()) {
    try {
      const native = await invoke<WebviewInfo | null>("get_webview_version");
      // The runtime's OS→engine mapping is the desktop authority — prefer it
      // over the UA parse so the two can never disagree on the same machine.
      if (native?.engine && native.version) {
        return formatWebviewInfo({ engine: native.engine, version: native.version });
      }
    } catch (error) {
      console.warn("[webview-info] get_webview_version failed, falling back to UA:", error);
    }
  }
  return formatWebviewInfo({ engine, version });
}
