/**
 * BLACKPOOL AFTER DARK - PROGRESSION, BADGES, CHECK-INS, HOURS & EVENTS
 * File: progress.js
 * Description: One player profile that every mode feeds into: XP and levels, badges,
 * daily streaks, GPS check-ins. Also opening hours ("open now"), the night bonus,
 * seasonal events and a seeded random generator for daily challenges and races.
 * Depends on config.js and app.js. Exposes window.Progress.
 */
(function () {
  "use strict";

  const CONFIG = window.GAME_CONFIG;
  const { getAllVenuesFlatList, VENUE_DATABASE } = window.NightlifeGeo;
  const STORE_KEY = "bad_profile_v1";

  // ==========================================
  // 1. SEEDED RANDOM (same venues for everyone with the same seed)
  // ==========================================
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }

  function seededRandom(seedText) {
    let a = hashString(seedText);
    return function () { // mulberry32
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seedText) {
    const rand = seededRandom(seedText);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ==========================================
  // 2. DATES, NIGHT BONUS & SEASONAL EVENTS
  // ==========================================
  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Daily #1 is launch day; everyone on the same date gets the same number and venues
  const LAUNCH = new Date(2026, 9, 10);
  function dailyNumber(date) {
    const d = date || new Date();
    const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((mid - LAUNCH) / 86400000) + 1;
  }

  function isNight(date) {
    const h = (date || new Date()).getHours();
    const [from, to] = CONFIG.NIGHT_HOURS;
    return from > to ? (h >= from || h < to) : (h >= from && h < to);
  }

  function activeEvent(date) {
    const d = date || new Date();
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    return CONFIG.EVENTS.find(e => {
      const from = e.from.month * 100 + e.from.day;
      const to = e.to.month * 100 + e.to.day;
      return from <= to ? (md >= from && md <= to) : (md >= from || md <= to);
    }) || null;
  }

  function xpMultiplier(date) {
    const ev = activeEvent(date);
    return (ev ? ev.xpMultiplier : 1) * (isNight(date) ? CONFIG.NIGHT_XP_BONUS : 1);
  }

  // ==========================================
  // 3. OPENING HOURS (placeholders from config)
  // ==========================================
  function hoursFor(venue) {
    if (CONFIG.OPENING_HOURS_BY_VENUE[venue.id]) return CONFIG.OPENING_HOURS_BY_VENUE[venue.id];
    const rule = CONFIG.OPENING_HOURS_BY_TYPE.find(r => venue.type.indexOf(r.match) !== -1);
    return rule ? rule.hours : null;
  }

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function slotFor(hours, weekday) {
    return Object.prototype.hasOwnProperty.call(hours, weekday) ? hours[weekday] : hours.default;
  }

  // Returns { open: bool, until: "HH:MM" } or null when hours are unknown
  function openStatus(venue, date) {
    const hours = hoursFor(venue);
    if (!hours) return null;
    const d = date || new Date();
    const now = d.getHours() * 60 + d.getMinutes();
    const today = slotFor(hours, d.getDay());
    const yesterday = slotFor(hours, (d.getDay() + 6) % 7);

    // Still open from last night?
    if (yesterday) {
      const [o, c] = yesterday.map(toMinutes);
      if (c < o && now < c) return { open: true, until: yesterday[1] };
    }
    if (today) {
      const [o, c] = today.map(toMinutes);
      if (c < o ? now >= o : (now >= o && now < c)) return { open: true, until: today[1] };
      if (now < o) return { open: false, opensAt: today[0] };
    }
    return { open: false };
  }

  function openLabel(venue, date) {
    const s = openStatus(venue, date);
    if (!s) return "";
    if (s.open) return "Open now · until " + s.until;
    return s.opensAt ? "Closed · opens " + s.opensAt : "Closed today";
  }

  // ==========================================
  // 4. PROFILE STORAGE
  // ==========================================
  function blankProfile() {
    return {
      id: "p" + Math.random().toString(36).slice(2, 10),
      name: "",
      xp: 0,
      badges: {},          // id -> date earned
      checkins: {},        // venueId -> [dayKey, ...]
      daily: {},           // dayKey -> { score, results }
      streak: 0,
      lastDaily: null,
      stats: { games: 0, rounds: 0, perfects: 0, crawls: 0, races: 0, raceWins: 0, best: 0 }
    };
  }

  let profile = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(blankProfile(), JSON.parse(raw));
    } catch (e) { /* storage blocked */ }
    return blankProfile();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(profile)); } catch (e) { /* storage blocked */ }
  }

  // ==========================================
  // 5. XP & LEVELS
  // ==========================================
  // Level n needs 100 * n^2 XP in total: 100, 400, 900, 1600...
  function levelFor(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
  function xpForLevel(level) { return 100 * (level - 1) * (level - 1); }

  const LEVEL_TITLES = ["Lightweight", "Regular", "Local", "Bar Fly", "Crawl Captain", "Night Owl", "Prom Legend", "Tower Royalty"];
  function titleFor(level) { return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2))]; }

  function levelInfo() {
    const level = levelFor(profile.xp);
    const from = xpForLevel(level);
    const to = xpForLevel(level + 1);
    return { level, title: titleFor(level), xp: profile.xp, progress: (profile.xp - from) / (to - from), toNext: to - profile.xp };
  }

  // Adds XP with the event + night multiplier. Returns the XP actually added.
  function addXp(base) {
    const gained = Math.round(base * xpMultiplier());
    profile.xp += gained;
    save();
    return gained;
  }

  // ==========================================
  // 6. BADGES
  // ==========================================
  const DISTRICT_BADGES = VENUE_DATABASE.map((d, i) => ({
    id: "district_" + i,
    name: "Local: " + d.district.replace(/^The /, ""),
    desc: "Check in at every venue in " + d.district,
    icon: "📍"
  }));

  const BADGES = [
    { id: "first_find", name: "First Round", desc: "Finish your first round", icon: "🍺" },
    { id: "sharpshooter", name: "Sharpshooter", desc: "Score a Perfect guess", icon: "🎯" },
    { id: "high_roller", name: "High Roller", desc: "Score 20,000+ in one game", icon: "💎" },
    { id: "daily_1", name: "Daily Drinker", desc: "Finish a Daily Challenge", icon: "📅" },
    { id: "streak_3", name: "Three-Night Run", desc: "Play the Daily 3 days in a row", icon: "🔥" },
    { id: "streak_7", name: "Week-Long Bender", desc: "Play the Daily 7 days in a row", icon: "🌋" },
    { id: "crawler", name: "Crawler", desc: "Finish a Pub Crawl", icon: "🚶" },
    { id: "racer", name: "Racer", desc: "Finish a race", icon: "🏁" },
    { id: "race_winner", name: "Podium Top", desc: "Win a race against at least one friend", icon: "🏆" },
    { id: "first_checkin", name: "Checked In", desc: "Check in at a venue for real", icon: "✅" },
    { id: "in_person", name: "Found It In Person", desc: "Find a mystery venue on the street", icon: "🕵️" },
    { id: "regular", name: "Regular", desc: "Check in at 5 different venues", icon: "🪪" },
    { id: "completionist", name: "Completionist", desc: "Check in at all 40 venues", icon: "👑" },
    { id: "night_owl", name: "Night Owl", desc: "Finish a game after midnight", icon: "🦉" },
    { id: "illuminations", name: "Lights On", desc: "Play during the Illuminations", icon: "💡" },
    { id: "pride", name: "Proud", desc: "Play during Blackpool Pride", icon: "🏳️‍🌈" },
    { id: "halloween", name: "Spooked", desc: "Play during Halloween week", icon: "🎃" },
    { id: "nye", name: "Last Orders", desc: "Play on New Year's Eve", icon: "🎆" }
  ].concat(DISTRICT_BADGES);

  // Awards a badge once. Returns the badge if it is new, else null.
  function award(id) {
    if (profile.badges[id]) return null;
    const badge = BADGES.find(b => b.id === id);
    if (!badge) return null;
    profile.badges[id] = dayKey();
    save();
    return badge;
  }

  // ==========================================
  // 7. CHECK-INS (On the street)
  // ==========================================
  function checkedInToday(venueId) {
    return (profile.checkins[venueId] || []).indexOf(dayKey()) !== -1;
  }

  // Records a check-in. Returns { xp, badges } or null if already checked in today.
  function checkIn(venue, foundInRound) {
    if (checkedInToday(venue.id)) return null;
    (profile.checkins[venue.id] = profile.checkins[venue.id] || []).push(dayKey());
    const xp = addXp(foundInRound ? 300 : 150);
    const badges = [award("first_checkin")];
    if (foundInRound) badges.push(award("in_person"));
    const visited = Object.keys(profile.checkins);
    if (visited.length >= 5) badges.push(award("regular"));
    if (visited.length >= getAllVenuesFlatList().length) badges.push(award("completionist"));
    VENUE_DATABASE.forEach((d, i) => {
      if (d.venues.every(v => profile.checkins[v.id])) badges.push(award("district_" + i));
    });
    save();
    return { xp, badges: badges.filter(Boolean) };
  }

  // ==========================================
  // 8. END OF GAME
  // ==========================================
  // results: [{ venue, distance, points, perfect }]
  // kind: "quick" | "daily" | "crawl" | "race"
  // Returns { xp, badges, streak, levelUp }
  function finishGame(kind, results, extra) {
    const before = levelFor(profile.xp);
    const total = results.reduce((s, r) => s + r.points, 0);
    const badges = [];
    let base = results.reduce((s, r) => s + r.points / 50, 0) + 50;

    profile.stats.games++;
    profile.stats.rounds += results.length;
    profile.stats.best = Math.max(profile.stats.best, total);
    if (results.length) badges.push(award("first_find"));
    if (results.some(r => r.perfect)) { profile.stats.perfects++; badges.push(award("sharpshooter")); }
    if (total >= 20000) badges.push(award("high_roller"));
    const h = new Date().getHours();
    if (h >= 0 && h < 4) badges.push(award("night_owl"));
    const ev = activeEvent();
    if (ev) badges.push(award(ev.id));

    if (kind === "daily") {
      base += 100;
      const today = dayKey();
      const yesterday = dayKey(new Date(Date.now() - 86400000));
      profile.streak = profile.lastDaily === yesterday ? profile.streak + 1 : (profile.lastDaily === today ? profile.streak : 1);
      profile.lastDaily = today;
      profile.daily[today] = { score: total, results: results.map(r => r.points) };
      badges.push(award("daily_1"));
      if (profile.streak >= 3) badges.push(award("streak_3"));
      if (profile.streak >= 7) badges.push(award("streak_7"));
    }
    if (kind === "crawl") { base += 150; profile.stats.crawls++; badges.push(award("crawler")); }
    if (kind === "race") {
      base += 100;
      profile.stats.races++;
      badges.push(award("racer"));
      if (extra && extra.won) { profile.stats.raceWins++; base += 200; badges.push(award("race_winner")); }
    }

    const xp = addXp(base);
    save();
    return { xp, badges: badges.filter(Boolean), streak: profile.streak, levelUp: levelFor(profile.xp) > before ? levelFor(profile.xp) : 0 };
  }

  function dailyPlayed() { return profile.daily[dayKey()] || null; }

  function setName(name) {
    profile.name = String(name || "").trim().slice(0, 20);
    save();
  }

  window.Progress = {
    seededShuffle, dayKey, dailyNumber, isNight, activeEvent, xpMultiplier,
    openStatus, openLabel,
    levelInfo, addXp, award, BADGES,
    checkIn, checkedInToday, finishGame, dailyPlayed, setName,
    get profile() { return profile; }
  };
})();
