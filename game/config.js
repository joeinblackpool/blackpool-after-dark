/**
 * BLACKPOOL AFTER DARK - CONFIG
 * Everything here is safe to edit.
 */
window.GAME_CONFIG = {
  // ------------------------------------------
  // Google Maps (live Street View)
  // ------------------------------------------
  // Paste your Google Maps JavaScript API key between the quotes, or paste it in the game's Settings.
  // Get one at https://console.cloud.google.com/google/maps-apis (enable "Maps JavaScript API").
  // With no key the game still runs in Clue Mode: written clues plus the guess map.
  GOOGLE_MAPS_API_KEY: "",

  // ------------------------------------------
  // Live races (optional)
  // ------------------------------------------
  // Paste a Firebase Realtime Database URL to get live race leaderboards, e.g.
  // "https://your-project-default-rtdb.europe-west1.firebasedatabase.app"
  // Without it, races still work: everyone with the same code gets the same venues and compares scores.
  // See README.md for the 2-minute setup.
  FIREBASE_DB_URL: "",

  // ------------------------------------------
  // Game rules
  // ------------------------------------------
  ROUNDS_PER_GAME: 5,
  DAILY_ROUNDS: 3,
  CRAWL_STOPS: 5,
  ROUND_TIME_SECONDS: 120,
  CRAWL_ROUND_SECONDS: 300,
  HINT_PENALTY: 0.25,          // fraction of the round score lost for each paid hint
  CHECKIN_RADIUS_METERS: 35,   // how close you must be to a venue to check in
  NIGHT_HOURS: [20, 4],        // 8pm to 4am counts as "night" for the night owl bonus
  NIGHT_XP_BONUS: 1.1,

  // ------------------------------------------
  // Seasonal events (PLACEHOLDER DATES: check each year)
  // month is 1-12. A range can wrap past New Year.
  // ------------------------------------------
  EVENTS: [
    { id: "illuminations", name: "Blackpool Illuminations", from: { month: 8, day: 29 }, to: { month: 1, day: 3 },
      xpMultiplier: 1.5, blurb: "The lights are on. 1.5x XP all season." },
    { id: "pride", name: "Blackpool Pride", from: { month: 6, day: 1 }, to: { month: 6, day: 30 },
      xpMultiplier: 1.5, blurb: "Pride month. 1.5x XP, extra on the Village venues." },
    { id: "halloween", name: "Halloween", from: { month: 10, day: 24 }, to: { month: 10, day: 31 },
      xpMultiplier: 1.25, blurb: "Spooky season. 1.25x XP." },
    { id: "nye", name: "New Year's Eve", from: { month: 12, day: 31 }, to: { month: 12, day: 31 },
      xpMultiplier: 2, blurb: "Last orders of the year. Double XP." }
  ],

  // ------------------------------------------
  // Opening hours (PLACEHOLDERS: replace with each venue's real hours)
  // Times are "HH:MM", 24-hour. A close time earlier than the open time means past midnight.
  // days: 0 = Sunday ... 6 = Saturday. The first rule whose "match" text appears in the
  // venue type is used. Add a venue id under OPENING_HOURS_BY_VENUE to override it.
  // ------------------------------------------
  OPENING_HOURS_BY_TYPE: [
    { match: "Nightclub", hours: { default: ["22:00", "03:00"], 0: null, 1: null } },
    { match: "Club",      hours: { default: ["21:00", "03:00"] } },
    { match: "Cabaret",   hours: { default: ["19:00", "02:00"] } },
    { match: "Pub",       hours: { default: ["11:00", "23:00"], 5: ["11:00", "00:30"], 6: ["11:00", "00:30"] } },
    { match: "Bar",       hours: { default: ["12:00", "00:00"], 5: ["12:00", "02:00"], 6: ["12:00", "02:00"] } }
  ],
  OPENING_HOURS_BY_VENUE: {
    // "lgbt_01": { default: ["20:00", "02:00"] }
  }
};
