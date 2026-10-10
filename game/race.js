/**
 * BLACKPOOL AFTER DARK - LIVE RACES
 * File: race.js
 * Description: Friends share a 5-character race code. The code decides the venues, so
 * everyone with the same code plays the same rounds. With a Firebase Realtime Database
 * URL in config.js, scores sync live through Firebase's REST API (no SDK needed).
 * Without one, races still work and players compare scores by sharing results.
 * Exposes window.Race.
 */
(function () {
  "use strict";

  const CONFIG = window.GAME_CONFIG;
  const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, to avoid mix-ups with 1 and 0
  const POLL_MS = 3000;

  // Code = 4 letters + 1 digit for the district (0 = all of Blackpool, 1-5 = a district)
  function newCode(districtIndex) {
    let c = "";
    for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    return c + String(districtIndex);
  }

  function parseCode(raw) {
    const code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]{4}[0-9]$/.test(code)) return null;
    return { code, districtIndex: Number(code[4]) };
  }

  function isLive() { return !!CONFIG.FIREBASE_DB_URL; }

  function url(path) {
    return CONFIG.FIREBASE_DB_URL.replace(/\/+$/, "") + "/races/" + path + ".json";
  }

  // Saves this player's progress: { name, score, round, done }
  async function report(code, playerId, data) {
    if (!isLive()) return false;
    try {
      const res = await fetch(url(code + "/players/" + playerId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ updated: Date.now() }, data))
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // Returns players sorted by score, highest first
  async function leaderboard(code) {
    if (!isLive()) return [];
    try {
      const res = await fetch(url(code + "/players"));
      if (!res.ok) return [];
      const players = (await res.json()) || {};
      return Object.keys(players)
        .map(id => Object.assign({ id }, players[id]))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
    } catch (e) {
      return [];
    }
  }

  // Calls onUpdate(players) every few seconds until the returned stop() is called
  function watch(code, onUpdate) {
    if (!isLive()) return () => {};
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      onUpdate(await leaderboard(code));
      if (!stopped) setTimeout(tick, POLL_MS);
    };
    tick();
    return () => { stopped = true; };
  }

  window.Race = { newCode, parseCode, isLive, report, leaderboard, watch };
})();
