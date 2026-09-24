/**
 * The single authoritative StreetUI framework version.
 *
 * This constant is the one source of truth for the version of the shipped
 * `streetui` package. It is kept in lock-step with this package's
 * `package.json` `version` field and with the bundled CLI's reported version
 * (`streetui --version`) — the consolidated test-suite pins all three to the
 * same coordinated release so they can never silently drift apart.
 */
export const VERSION = '1.3.0';
