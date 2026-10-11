# Future Chrome Extension

The extension is deliberately deferred until the web MVP is stable. No extension is shipped in this release.

Use Manifest V3, a packaged popup, and a `chrome.storage.local` adapter for quick task entry and focus controls. Reuse `web/js/core` business logic (separate the IndexedDB-specific timer transaction from its pure transitions when packaging). Bundle all code locally; start with only the `storage` permission. Add `alarms` and an event-driven service worker for background completion alerts. Persist timer state across worker restarts.

Website and extension data live in separate origins. Reuse LifeOS version 1 JSON backups for manual transfer; automatic synchronization, content scripts and host permissions remain deferred. A popup provides an Open LifeOS link to the configured production web origin.
