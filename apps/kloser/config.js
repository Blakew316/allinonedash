/**
 * Deployment config.
 *
 * MAPS_KEY — a Google Maps JavaScript API key. Put one here and the Map screen
 * loads Google Maps, exactly like the original site did: the map fills the
 * screen and the app's own Area Search / Biz Search / Select Leads / Filters
 * controls float on top of it.
 *
 * Enable these two APIs on the key:
 *   • Maps JavaScript API  — draws the map
 *   • Geocoding API        — turns each lead's street address into an exact pin
 *
 * Restrict it to your own domain in the Google Cloud console; this file ships to
 * the browser, so anyone can read it. That restriction is what stops it being
 * used elsewhere.
 *
 * Leave it empty and the app falls back to its own built-in map, which needs no
 * key and works offline.
 */
export const MAPS_KEY = '';

/**
 * GOOGLE_CLIENT_ID — an OAuth 2.0 Web client ID. With one set, "Connect Google
 * Account" in Settings — and "Connect Google Calendar" on the Rep Schedule —
 * opens Google's real consent screen and asks for Calendar events and Gmail send,
 * which is what those screens say they do.
 *
 * With an account connected, the Rep Schedule calendar pulls that account's
 * Google Calendar events for whichever month is on screen and draws them
 * alongside the CRM's own, and a CRM appointment can be pushed the other way
 * from its detail sheet.
 *
 * Two things to set up on the Google Cloud project:
 *   • Enable the Google Calendar API
 *   • Add this app's origin to the client's Authorized JavaScript origins
 * Without the second one, Google refuses the sign-in outright.
 *
 * There is no server here, so the token lives in this browser and expires the
 * way Google issued it. Nothing syncs in the background.
 */
export const GOOGLE_CLIENT_ID = '';

/** Optional: where the map opens before it fits to the pins. [lat, lng, zoom] */
export const MAP_HOME = [39.5, -98.35, 4];
