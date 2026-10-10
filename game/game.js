/**
 * BLACKPOOL AFTER DARK - GAME LOOP & UI
 * File: game.js
 * Description: Four games that share one profile (progress.js):
 *   Daily Challenge: 3 venues, the same for everyone each day, builds a streak.
 *   Quick Crawl:     5 random venues.
 *   Pub Crawl:       a walking route; each find reveals the next venue's clue.
 *   Race Friends:    a shared code gives everyone the same venues; live leaderboard (race.js).
 * Each can be played two ways:
 *   At home:       walk freely through Street View (tap the arrows or the road, or use the arrow keys).
 *   On the street: your phone's GPS and compass drive Street View, with an optional live camera
 *                  overlay. Walk to venues for real and check in for XP and badges.
 * Depends on config.js, app.js, progress.js and race.js.
 */
(function () {
  "use strict";

  const { VENUE_DATABASE, calculateDistanceInMeters, calculateScore, getAllVenuesFlatList } = window.NightlifeGeo;
  const CONFIG = window.GAME_CONFIG;
  const Progress = window.Progress;
  const Race = window.Race;
  const BLACKPOOL_CENTER = [53.8125, -3.0515];
  const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const SCAN_LOCK_DEGREES = 14;     // how close to the venue bearing counts as "facing it"
  const SCAN_HOLD_MS = 1200;        // how long to hold the lock before the clue is revealed
  const STREET_ROUND_SECONDS = 900; // on the street you are walking, so rounds are longer
  const STREET_POOL_SIZE = 10;      // on the street, rounds are picked from the venues nearest to you
  const GPS_REPANO_METERS = 6;      // how far you walk before Street View jumps to a new panorama
  const GAME_NAMES = { daily: "Daily Challenge", quick: "Quick Crawl", crawl: "Pub Crawl", race: "Race" };

  // ==========================================
  // 1. STATE
  // ==========================================
  const settings = loadSettings();
  const state = {
    mode: "clue",            // "streetview" when Google loads, "clue" otherwise
    playMode: "home",        // "home" or "street"
    game: "daily",           // "daily" | "quick" | "crawl" | "race"
    rounds: [],
    roundIndex: 0,
    totalScore: 0,
    results: [],
    current: null,           // { venue, startPano, hintsBought, scanned, clueMode, svOk }
    guessLatLng: null,
    guessFromGps: false,
    timerId: null,
    timeLeft: 0,
    scanHoldStart: 0,
    gps: null,               // { lat, lng, accuracy }
    gpsWatchId: null,
    lastPanoLookup: null,
    compass: null,           // degrees from north, smoothed
    pitch: 0,
    cameraStream: null,
    nearbyVenue: null,       // venue close enough to check in at
    race: null,              // { code, players, stopWatch }
    earned: { xp: 0, badges: [] } // check-in rewards during this game
  };

  let panorama = null;
  let svService = null;
  let guessMap = null;
  let guessMarker = null;
  let resultMap = null;

  const $ = id => document.getElementById(id);

  // ==========================================
  // 2. SETTINGS & GOOGLE MAPS LOADING
  // ==========================================
  function loadSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("bad_settings") || "{}"); } catch (e) { /* storage blocked */ }
    return {
      apiKey: saved.apiKey || CONFIG.GOOGLE_MAPS_API_KEY || "",
      roundTime: saved.roundTime || CONFIG.ROUND_TIME_SECONDS
    };
  }

  function saveSettings() {
    try { localStorage.setItem("bad_settings", JSON.stringify(settings)); } catch (e) { /* storage blocked */ }
  }

  function loadGoogleMaps(key) {
    return new Promise(resolve => {
      if (!key) return resolve(false);
      if (window.google && window.google.maps) return resolve(true);
      window.__badMapsReady = () => resolve(true);
      window.gm_authFailure = () => {
        toast("Google rejected the API key. Switching to Clue Mode.");
        state.mode = "clue";
        renderModeBadge();
        resolve(false);
      };
      const s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&callback=__badMapsReady";
      s.async = true;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function initGoogle() {
    const ok = await loadGoogleMaps(settings.apiKey);
    state.mode = ok ? "streetview" : "clue";
    renderModeBadge();
  }

  function renderModeBadge() {
    const badge = $("mode-badge");
    if (state.mode === "streetview") {
      badge.textContent = "Live Street View on";
      badge.className = "mode-badge live";
    } else {
      badge.textContent = settings.apiKey ? "Street View unavailable: playing Clue Mode" : "Clue Mode (add a Google Maps key in Settings for Street View)";
      badge.className = "mode-badge clue";
    }
  }

  // ==========================================
  // 3. GEOMETRY HELPERS
  // ==========================================
  function bearingBetween(from, to) {
    const toRad = d => d * Math.PI / 180;
    const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
    const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
      Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function angleDiff(a, b) {
    return ((a - b) % 360 + 540) % 360 - 180; // -180..180, positive means the target is to your right
  }

  function formatDistance(m) {
    return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km";
  }

  function ratingFor(distance, thresholds) {
    if (distance <= thresholds.perfect) return "Perfect";
    if (distance <= thresholds.good) return "Great";
    if (distance <= thresholds.acceptable) return "Close";
    if (distance <= 500) return "Right area";
    return "Wrong end of town";
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function latLngLiteral(ll) {
    return { lat: typeof ll.lat === "function" ? ll.lat() : ll.lat, lng: typeof ll.lng === "function" ? ll.lng() : ll.lng };
  }

  // Nearest-neighbour walking route through the pool, starting from `from`
  function walkingRoute(pool, from, stops) {
    const left = pool.slice();
    const route = [];
    let here = from;
    while (route.length < stops && left.length) {
      left.sort((a, b) => calculateDistanceInMeters(here, a.coordinates) - calculateDistanceInMeters(here, b.coordinates));
      const next = left.shift();
      route.push(next);
      here = next.coordinates;
    }
    return route;
  }

  // ==========================================
  // 4. SCREENS & HUB
  // ==========================================
  function show(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(screenId).classList.add("active");
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add("hidden"), 3000);
  }

  function initHub() {
    const sel = $("district-select");
    VENUE_DATABASE.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = String(i + 1);
      o.textContent = d.district + " (" + d.venues.length + ")";
      sel.appendChild(o);
    });
    sel.options[0].value = "0";

    const ev = Progress.activeEvent();
    if (ev) document.body.dataset.event = ev.id;
    renderHub();
  }

  function renderHub() {
    const info = Progress.levelInfo();
    const p = Progress.profile;
    $("pb-level").textContent = info.level;
    $("pb-title").textContent = (p.name ? p.name + " · " : "") + info.title + " · " + info.xp.toLocaleString() + " XP";
    $("pb-xp").style.width = Math.round(info.progress * 100) + "%";
    $("pb-streak").textContent = "🔥 " + p.streak;

    const ev = Progress.activeEvent();
    const night = Progress.isNight();
    const banner = $("event-banner");
    const parts = [];
    if (ev) parts.push("<b>" + ev.name + "</b> · " + ev.blurb);
    if (night) parts.push("<b>Night owl hours</b> · +" + Math.round((CONFIG.NIGHT_XP_BONUS - 1) * 100) + "% XP");
    banner.innerHTML = parts.join("<br>");
    banner.classList.toggle("hidden", !parts.length);

    const played = Progress.dailyPlayed();
    const dailyCard = document.querySelector('.gcard[data-game="daily"]');
    dailyCard.classList.toggle("done", !!played);
    $("daily-sub").textContent = played
      ? "Daily #" + Progress.dailyNumber() + " done: " + played.score.toLocaleString() + " pts. Back tomorrow"
      : "Daily #" + Progress.dailyNumber() + " · 3 venues, same for everyone today";

    renderGamePicker();
  }

  function renderGamePicker() {
    document.querySelectorAll("#game-picker .gcard").forEach(c => c.classList.toggle("active", c.dataset.game === state.game));
    $("race-box").classList.toggle("hidden", state.game !== "race");
    $("district-field").classList.toggle("hidden", state.game === "daily");
    $("btn-start").textContent = state.game === "daily" && Progress.dailyPlayed() ? "Share today's result" : "Start " + GAME_NAMES[state.game];
    if (state.game === "race") {
      if (!$("race-code").value) newRaceCode();
      $("race-note").textContent = (Race.isLive()
        ? "Live leaderboard on. "
        : "Send friends this code. Add a Firebase URL in config.js for a live leaderboard. ") +
        "Typing a friend's code joins their race.";
    }
  }

  function newRaceCode() {
    $("race-code").value = Race.newCode(Number($("district-select").value));
  }

  function renderProfile() {
    const p = Progress.profile;
    const info = Progress.levelInfo();
    $("input-name").value = p.name;
    const stat = (label, value) => "<div><b>" + value + "</b><span class=\"small\">" + label + "</span></div>";
    $("profile-stats").innerHTML =
      stat("Level " + info.level, info.title) +
      stat("XP", info.xp.toLocaleString()) +
      stat("Daily streak", "🔥 " + p.streak) +
      stat("Games", p.stats.games) +
      stat("Check-ins", Object.keys(p.checkins).length + "/40") +
      stat("Best game", p.stats.best.toLocaleString());
    const grid = $("badge-grid");
    grid.innerHTML = "";
    Progress.BADGES.forEach(b => grid.appendChild(badgeEl(b, !p.badges[b.id])));
  }

  function badgeEl(b, locked) {
    const el = document.createElement("div");
    el.className = "badge" + (locked ? " locked" : "");
    el.title = b.desc;
    const ic = document.createElement("span");
    ic.className = "ic";
    ic.textContent = b.icon;
    const name = document.createElement("b");
    name.textContent = b.name;
    el.append(ic, name, b.desc);
    return el;
  }

  // ==========================================
  // 5. SENSORS (On the street)
  // ==========================================
  function startGps() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { toast("This device has no GPS access."); return resolve(false); }
      let first = true;
      state.gpsWatchId = navigator.geolocation.watchPosition(pos => {
        state.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        const chip = $("gps-chip");
        chip.textContent = "GPS ±" + Math.round(pos.coords.accuracy) + " m";
        chip.classList.toggle("good", pos.coords.accuracy <= 15);
        if (first) { first = false; resolve(true); }
        onGpsUpdate();
      }, err => {
        $("gps-chip").textContent = "GPS: " + (err.code === 1 ? "permission denied" : "no signal");
        if (first) { first = false; resolve(false); }
      }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    });
  }

  function stopSensors() {
    if (state.gpsWatchId !== null) navigator.geolocation.clearWatch(state.gpsWatchId);
    state.gpsWatchId = null;
    window.removeEventListener("deviceorientationabsolute", onOrientation);
    window.removeEventListener("deviceorientation", onOrientation);
    stopCamera();
  }

  async function startCompass() {
    // iPhone asks for permission; Android does not
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        if (await DeviceOrientationEvent.requestPermission() !== "granted") { toast("Compass permission denied."); return; }
      } catch (e) { /* must be called from a tap; the Start button is one */ }
    }
    if ("ondeviceorientationabsolute" in window) window.addEventListener("deviceorientationabsolute", onOrientation);
    else window.addEventListener("deviceorientation", onOrientation);
  }

  function onOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === "number") heading = e.webkitCompassHeading;       // iPhone
    else if (e.absolute !== false && typeof e.alpha === "number") heading = 360 - e.alpha;   // Android
    if (heading === null) return;
    const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    heading = (heading + screenAngle + 360) % 360;

    // Smooth out compass jitter
    state.compass = state.compass === null ? heading : (state.compass + angleDiff(heading, state.compass) * 0.25 + 360) % 360;
    // Phone held upright (beta ~ 90) looks straight ahead
    if (typeof e.beta === "number") state.pitch = Math.max(-60, Math.min(60, e.beta - 90));

    if (panorama && state.current && state.current.svOk && state.playMode === "street") {
      panorama.setPov({ heading: state.compass, pitch: state.pitch });
    } else {
      updateScanner();
    }
  }

  function onGpsUpdate() {
    if (state.playMode !== "street" || !state.current) return;
    updateScanner();
    updateCheckinChip();
    if (!state.current.svOk || !state.gps) return;
    const last = state.lastPanoLookup;
    if (last && calculateDistanceInMeters(last, state.gps) < GPS_REPANO_METERS) return;
    state.lastPanoLookup = { lat: state.gps.lat, lng: state.gps.lng };
    findPano(state.gps, 40).then(data => { if (data) panorama.setPano(data.location.pano); });
  }

  async function startCamera() {
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      const v = $("camera");
      v.srcObject = state.cameraStream;
      v.classList.remove("hidden");
      $("blend-wrap").classList.toggle("hidden", !state.current.svOk);
      $("btn-camera").textContent = "Camera off";
      $("street-fallback").classList.add("hidden");
      applyBlend();
    } catch (e) {
      toast("Couldn't open the camera.");
    }
  }

  function stopCamera() {
    if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
    $("camera").classList.add("hidden");
    $("blend-wrap").classList.add("hidden");
    $("btn-camera").textContent = "Camera on";
    $("pano").style.opacity = "";
    if (state.current && !state.current.svOk && state.playMode === "street") $("street-fallback").classList.remove("hidden");
  }

  function applyBlend() {
    if (!state.cameraStream) return;
    $("pano").style.opacity = String(Number($("blend").value) / 100);
  }

  // ==========================================
  // 6. CHECK-INS (On the street)
  // ==========================================
  function nearestVenueInReach() {
    if (!state.gps) return null;
    const reach = CONFIG.CHECKIN_RADIUS_METERS + Math.min(25, state.gps.accuracy || 0);
    let best = null;
    getAllVenuesFlatList().forEach(v => {
      const d = calculateDistanceInMeters(state.gps, v.coordinates);
      if (d <= reach && (!best || d < best.d)) best = { v, d };
    });
    return best ? best.v : null;
  }

  function updateCheckinChip() {
    const chip = $("checkin-chip");
    const v = state.playMode === "street" && $("screen-game").classList.contains("active") ? nearestVenueInReach() : null;
    state.nearbyVenue = v;
    if (!v) return chip.classList.add("hidden");
    const isTarget = state.current && v.id === state.current.venue.id;
    if (!isTarget && Progress.checkedInToday(v.id)) return chip.classList.add("hidden");
    // Don't give away the mystery venue's name before it's found
    chip.textContent = isTarget ? "📍 You found it! Check in" : "✅ Check in at " + v.name;
    chip.classList.remove("hidden");
  }

  function onCheckinTap() {
    const v = state.nearbyVenue;
    if (!v) return;
    if (state.current && v.id === state.current.venue.id) {
      // Standing at the mystery venue: guess with your real position, check in, finish the round
      pinMyLocation();
      submitGuess(false);
      return;
    }
    const reward = Progress.checkIn(v, false);
    if (reward) rewardToast("Checked in at " + v.name, reward);
    updateCheckinChip();
  }

  function rewardToast(what, reward) {
    state.earned.xp += reward.xp;
    state.earned.badges = state.earned.badges.concat(reward.badges);
    const badgeText = reward.badges.length ? " · New badge: " + reward.badges.map(b => b.icon + " " + b.name).join(", ") : "";
    toast(what + " · +" + reward.xp + " XP" + badgeText);
    if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
  }

  // ==========================================
  // 7. GAME FLOW
  // ==========================================
  async function startGame() {
    // Daily already done today: the button shares the result instead
    if (state.game === "daily" && Progress.dailyPlayed()) return shareDaily();

    const districtIndex = Number($("district-select").value);
    const inDistrict = v => districtIndex === 0 || v.district_name === VENUE_DATABASE[districtIndex - 1].district;
    let pool = getAllVenuesFlatList();
    state.race = null;
    state.earned = { xp: 0, badges: [] };

    // Daily and races must give everyone the same venues, so they ignore your location
    const fixedVenues = state.game === "daily" || state.game === "race";

    if (state.playMode === "street") {
      $("btn-start").disabled = true;
      $("btn-start").textContent = "Finding you...";
      startCompass();                     // must start inside the tap on iPhone
      const gpsOk = await startGps();
      $("btn-start").disabled = false;
      renderGamePicker();
      if (!gpsOk) { toast("On the street needs your location. Try At home instead."); stopSensors(); return; }
    }

    if (state.game === "daily") {
      state.rounds = Progress.seededShuffle(pool, "daily-" + Progress.dayKey()).slice(0, CONFIG.DAILY_ROUNDS);
    } else if (state.game === "race") {
      const parsed = Race.parseCode($("race-code").value);
      if (!parsed || parsed.districtIndex > VENUE_DATABASE.length) { toast("Race codes look like ABCD1."); stopSensors(); return; }
      const racePool = pool.filter(v => parsed.districtIndex === 0 || v.district_name === VENUE_DATABASE[parsed.districtIndex - 1].district);
      state.rounds = Progress.seededShuffle(racePool, "race-" + parsed.code).slice(0, CONFIG.ROUNDS_PER_GAME);
      state.race = { code: parsed.code, players: [], stopWatch: null };
    } else {
      pool = pool.filter(inDistrict);
      if (state.playMode === "street" && !fixedVenues) pool = nearestPlayable(pool);
      if (state.game === "crawl") {
        const from = state.playMode === "street" ? state.gps : shuffle(pool)[0].coordinates;
        state.rounds = walkingRoute(pool, from, CONFIG.CRAWL_STOPS);
      } else {
        state.rounds = shuffle(pool).slice(0, Math.min(CONFIG.ROUNDS_PER_GAME, pool.length));
      }
    }

    state.roundIndex = 0;
    state.totalScore = 0;
    state.results = [];
    show("screen-game");
    ensureGuessMap();
    if (state.race) startRaceWatch();
    startRound();
  }

  // On the street: the venues nearest to you, open ones first when enough are open
  function nearestPlayable(pool) {
    const near = pool
      .map(v => ({ v, d: calculateDistanceInMeters(state.gps, v.coordinates) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, STREET_POOL_SIZE)
      .map(x => x.v);
    if (calculateDistanceInMeters(state.gps, near[0].coordinates) > 5000) {
      toast("You're a long way from Blackpool, so these venues will be far away.");
    }
    const open = near.filter(v => { const s = Progress.openStatus(v); return s && s.open; });
    return open.length >= 3 ? open : near;
  }

  async function startRound() {
    const venue = state.rounds[state.roundIndex];
    const street = state.playMode === "street";
    const prev = state.roundIndex > 0 ? state.rounds[state.roundIndex - 1] : null;
    const crawlLeg = state.game === "crawl" && prev;   // the previous find revealed this clue
    state.current = { venue, startPano: null, hintsBought: 0, scanned: !!crawlLeg, clueMode: false, svOk: false };
    state.guessLatLng = null;
    state.guessFromGps = false;
    state.scanHoldStart = 0;
    state.lastPanoLookup = null;

    $("hud-round").textContent = (state.roundIndex + 1) + "/" + state.rounds.length;
    $("hud-score").textContent = state.totalScore.toLocaleString();
    $("btn-guess").disabled = true;
    $("btn-guess").textContent = "Drop a pin";
    $("scanner").classList.toggle("locked", !!crawlLeg);
    $("signal-bar").style.width = "0%";
    $("guess-wrap").classList.remove("expanded");
    $("btn-camera").classList.toggle("hidden", !street);
    $("btn-here").classList.toggle("hidden", !street);
    $("gps-chip").classList.toggle("hidden", !street);
    $("checkin-chip").classList.add("hidden");

    if (guessMarker) { guessMap.removeLayer(guessMarker); guessMarker = null; }
    guessMap.setView(BLACKPOOL_CENTER, 14);
    setTimeout(() => guessMap.invalidateSize(), 50);

    if (state.mode === "streetview") {
      // On a crawl at home, each leg starts from the venue you just found
      state.current.svOk = street ? await loadStreetViewAtPlayer() : await loadStreetViewNearVenue(venue, crawlLeg ? prev : null);
    }
    const svOk = state.current.svOk;

    // Clue Mode only when At home without Street View; on the street the scanner works from GPS + compass
    state.current.clueMode = !svOk && !street;
    $("clue-mode").classList.toggle("hidden", !state.current.clueMode);
    $("pano").classList.toggle("hidden", !svOk);
    $("scanner").classList.toggle("hidden", state.current.clueMode);
    $("street-fallback").classList.toggle("hidden", !(street && !svOk && !state.cameraStream));
    $("btn-return").classList.toggle("hidden", street || !svOk);
    if (state.cameraStream) $("blend-wrap").classList.toggle("hidden", !svOk);

    if (state.current.clueMode) {
      state.current.scanned = true;  // the clue is the whole puzzle here, so it's free
      $("dossier-type").textContent = venue.type;
      $("dossier-clue").textContent = venue.gameplay.clue_hint;
    } else {
      $("scan-status").textContent = street
        ? "Turn on the spot. The signal gets stronger as you face the venue."
        : "Look and walk around. The signal gets stronger as you face the venue.";
    }
    renderIntel();
    updateScanner();
    updateCheckinChip();
    const seconds = street ? STREET_ROUND_SECONDS : state.game === "crawl" ? CONFIG.CRAWL_ROUND_SECONDS : settings.roundTime;
    startTimer(seconds);
  }

  function findPano(location, radius) {
    return new Promise(resolve => {
      const g = window.google.maps;
      if (!svService) svService = new g.StreetViewService();
      svService.getPanorama({
        location,
        radius,
        preference: g.StreetViewPreference.NEAREST,
        sources: [g.StreetViewSource.OUTDOOR]
      }, (data, status) => resolve(status === g.StreetViewStatus.OK ? data : null));
    });
  }

  function makePanorama(opts) {
    const g = window.google.maps;
    if (!panorama) {
      panorama = new g.StreetViewPanorama($("pano"), opts);
      panorama.addListener("pov_changed", updateScanner);
      panorama.addListener("position_changed", updateScanner);
    } else {
      panorama.setOptions(opts);
      panorama.setPano(opts.pano);
      panorama.setPov(opts.pov);
    }
  }

  // At home: drop the player near the venue (or at `startVenue` on a crawl), free to walk
  async function loadStreetViewNearVenue(venue, startVenue) {
    let data = await findPano((startVenue || venue).coordinates, 80);
    if (!data && startVenue) data = await findPano(venue.coordinates, 80);
    if (!data) { toast("No Street View here. This round is Clue Mode."); return false; }
    const panoLatLng = latLngLiteral(data.location.latLng);
    const target = bearingBetween(panoLatLng, venue.coordinates);
    const sv = venue.streetview_settings;
    const lock = sv.lock_movement === true;
    state.current.startPano = data.location.pano;
    makePanorama({
      pano: data.location.pano,
      // Normally start facing away so you have to scan; on a crawl leg you already know the way
      pov: { heading: startVenue ? target : (target + 120 + Math.random() * 120) % 360, pitch: sv.pitch || 0 },
      zoom: sv.zoom || 1,
      addressControl: false,
      showRoadLabels: false,
      linksControl: !lock,       // the arrows on the road
      clickToGo: !lock,          // tap the road to walk there
      scrollwheel: true,
      keyboardShortcuts: true,   // arrow keys walk and turn
      fullscreenControl: false,
      motionTracking: true,      // phone: turn your body to look around
      motionTrackingControl: true,
      enableCloseButton: false
    });
    return true;
  }

  // On the street: Street View follows the player's GPS and compass
  async function loadStreetViewAtPlayer() {
    const data = await findPano(state.gps, 50);
    if (!data) { toast("No Street View right here. Use the scanner and camera."); return false; }
    state.lastPanoLookup = { lat: state.gps.lat, lng: state.gps.lng };
    makePanorama({
      pano: data.location.pano,
      pov: { heading: state.compass || 0, pitch: state.pitch },
      zoom: 1,
      addressControl: false,
      showRoadLabels: false,
      linksControl: false,       // your feet do the walking
      clickToGo: false,
      keyboardShortcuts: false,
      fullscreenControl: false,
      motionTracking: false,     // we drive the view from the compass ourselves
      motionTrackingControl: false,
      enableCloseButton: false
    });
    return true;
  }

  function returnToStart() {
    if (!panorama || !state.current.startPano) return;
    panorama.setPano(state.current.startPano);
  }

  // ==========================================
  // 8. THE SCANNER (hunt mode)
  // ==========================================
  // Where the player is and which way they're looking, whichever mode they're in
  function viewer() {
    if (state.playMode === "street") {
      if (!state.gps) return null;
      const heading = state.current && state.current.svOk && panorama ? panorama.getPov().heading : state.compass;
      return heading === null ? null : { pos: state.gps, heading };
    }
    if (!panorama || !state.current || !state.current.svOk) return null;
    const pos = panorama.getPosition();
    return pos ? { pos: latLngLiteral(pos), heading: panorama.getPov().heading } : null;
  }

  function updateScanner() {
    if (!state.current || state.current.clueMode) return;
    const v = viewer();
    if (!v) return;
    const target = bearingBetween(v.pos, state.current.venue.coordinates);
    const diff = angleDiff(target, v.heading);
    const strength = Math.max(0, 1 - Math.abs(diff) / 180);
    const dist = calculateDistanceInMeters(v.pos, state.current.venue.coordinates);

    $("signal-bar").style.width = Math.round(strength * strength * 100) + "%";

    // Blip on the radar: the venue's direction relative to where you are looking (up = ahead), closer = nearer the middle
    const rad = diff * Math.PI / 180;
    const r = 12 + 26 * Math.min(1, dist / 400);
    $("radar-blip").style.left = (50 + Math.sin(rad) * r / 0.74) + "%";
    $("radar-blip").style.top = (50 - Math.cos(rad) * r / 0.74) + "%";

    // On the street and on crawls the scanner also tells you how far to walk
    const showDist = state.playMode === "street" || state.game === "crawl";
    const far = showDist ? " About " + formatDistance(dist) + " away." : "";

    if (state.current.scanned) {
      const dir = Math.abs(diff) <= SCAN_LOCK_DEGREES ? "Dead ahead." : "Turn " + (diff > 0 ? "right" : "left") + ".";
      $("scan-status").textContent = "Clue decoded. " + dir + far;
      return;
    }
    if (Math.abs(diff) <= SCAN_LOCK_DEGREES) {
      if (!state.scanHoldStart) {
        state.scanHoldStart = Date.now();
        setTimeout(checkScanHold, SCAN_HOLD_MS + 20);
      }
      $("scan-status").textContent = "Signal strong. Hold steady..." + far;
    } else {
      state.scanHoldStart = 0;
      const dir = diff > 0 ? "right" : "left";
      $("scan-status").textContent = (strength > 0.75 ? "Warmer. Keep turning " + dir + "." : "Turn " + dir + " to find the venue.") + far;
    }
  }

  function checkScanHold() {
    if (!state.scanHoldStart || state.current.scanned) return;
    if (Date.now() - state.scanHoldStart >= SCAN_HOLD_MS) onScanLock();
  }

  function onScanLock() {
    state.current.scanned = true;
    $("scanner").classList.add("locked");
    const lockEl = $("scan-lock");
    lockEl.classList.remove("hidden");
    // restart the CSS animation
    lockEl.querySelectorAll("*").forEach(el => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
    setTimeout(() => lockEl.classList.add("hidden"), 1700);
    if (navigator.vibrate) navigator.vibrate([40, 40, 80]);
    renderIntel();
    updateScanner();
  }

  // ==========================================
  // 9. INTEL & HINTS
  // ==========================================
  // Venue type is free; the clue is free once scanned; paid hints: district, then the street
  function paidHints(venue) {
    return [
      "District: " + venue.district_name,
      "Street: " + (venue.address ? venue.address.split(",")[0].replace(/^[\d\-\s]+/, "") : "unknown")
    ];
  }

  function renderIntel() {
    const v = state.current.venue;
    const list = $("intel-list");
    list.innerHTML = "";
    const add = (text, cls) => {
      const li = document.createElement("li");
      li.textContent = text;
      if (cls) li.className = cls;
      list.appendChild(li);
    };
    add("Venue type: " + v.type);
    if (state.current.clueMode) { /* the clue is already on the dossier card */ }
    else if (state.current.scanned) add("Clue: " + v.gameplay.clue_hint);
    else add("Scan the street to decode the clue", "locked-intel");
    paidHints(v).slice(0, state.current.hintsBought).forEach(h => add(h));

    const btn = $("btn-hint");
    const remaining = paidHints(v).length - state.current.hintsBought;
    btn.disabled = remaining <= 0;
    btn.textContent = remaining > 0 ? "Buy hint (-" + Math.round(CONFIG.HINT_PENALTY * 100) + "% points)" : "No hints left";
  }

  function buyHint() {
    state.current.hintsBought++;
    renderIntel();
  }

  // ==========================================
  // 10. GUESS MAP
  // ==========================================
  function pinIcon(cls) {
    return L.divIcon({ className: "", html: '<div class="pin ' + cls + '"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  function placeGuess(latlng, fromGps) {
    state.guessLatLng = { lat: latlng.lat, lng: latlng.lng };
    state.guessFromGps = !!fromGps;
    if (guessMarker) guessMarker.setLatLng(latlng);
    else guessMarker = L.marker(latlng, { icon: pinIcon("pin-guess") }).addTo(guessMap);
    $("btn-guess").disabled = false;
    $("btn-guess").textContent = "Lock in guess";
  }

  function ensureGuessMap() {
    if (guessMap) return;
    guessMap = L.map("guess-map", { zoomControl: false, attributionControl: true }).setView(BLACKPOOL_CENTER, 14);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(guessMap);
    guessMap.on("click", e => placeGuess(e.latlng, false));
    $("guess-wrap").addEventListener("transitionend", () => guessMap.invalidateSize());
  }

  // On the street: "I'm here" pins your real position, so standing at the door scores best
  function pinMyLocation() {
    if (!state.gps) return toast("Still waiting for GPS.");
    placeGuess(L.latLng(state.gps.lat, state.gps.lng), true);
    guessMap.setView([state.gps.lat, state.gps.lng], 17);
  }

  // ==========================================
  // 11. TIMER
  // ==========================================
  function startTimer(seconds) {
    clearInterval(state.timerId);
    state.timeLeft = seconds;
    renderTimer();
    state.timerId = setInterval(() => {
      state.timeLeft--;
      renderTimer();
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        toast("Time's up!");
        submitGuess(true);
      }
    }, 1000);
  }

  function renderTimer() {
    const t = Math.max(0, state.timeLeft);
    const el = $("hud-timer");
    el.textContent = Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
    el.classList.toggle("urgent", t <= 10);
  }

  // ==========================================
  // 12. RACES
  // ==========================================
  function playerName() {
    return Progress.profile.name || "Player " + Progress.profile.id.slice(-3).toUpperCase();
  }

  function reportRace(done) {
    if (!state.race) return;
    Race.report(state.race.code, Progress.profile.id, {
      name: playerName(),
      score: state.totalScore,
      round: state.results.length,
      done: !!done
    });
  }

  function startRaceWatch() {
    reportRace(false);
    state.race.stopWatch = Race.watch(state.race.code, players => {
      state.race.players = players;
      renderRaceBoards();
    });
    renderRaceBoards();
  }

  function boardHtml(players, max) {
    const me = Progress.profile.id;
    const rows = players.slice(0, max).map(p => {
      const status = p.done ? "done" : "round " + Math.min((p.round || 0) + 1, state.rounds.length);
      return "<li" + (p.id === me ? ' class="me"' : "") + ">" + escapeHtml(p.name || "Player") + " · " + (p.score || 0).toLocaleString() + " <span class=\"small\">(" + status + ")</span></li>";
    }).join("");
    return "<ol>" + rows + "</ol>";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderRaceBoards() {
    const live = $("race-live");
    if (!state.race) { live.classList.add("hidden"); return; }
    const players = state.race.players;
    const head = "<p class=\"eyebrow\">Race " + state.race.code + "</p>";
    if (!Race.isLive()) {
      live.innerHTML = head + "<span class=\"small\">Same venues as your friends. Compare scores at the end.</span>";
    } else if (!players.length) {
      live.innerHTML = head + "<span class=\"small\">Connecting...</span>";
    } else {
      live.innerHTML = head + boardHtml(players, 3);
    }
    live.classList.remove("hidden");
    ["res-board", "final-board"].forEach(id => {
      const el = $(id);
      el.innerHTML = "<p class=\"eyebrow\">Race " + state.race.code + "</p>" +
        (Race.isLive() && players.length ? boardHtml(players, 8) : "<span class=\"small\">Share your result and race code to compare with friends.</span>");
      el.classList.remove("hidden");
    });
  }

  // ==========================================
  // 13. SCORING & RESULTS
  // ==========================================
  function submitGuess(timedOut) {
    clearInterval(state.timerId);
    $("checkin-chip").classList.add("hidden");
    const v = state.current.venue;
    let distance = null;
    let points = 0;
    let inPerson = null;
    if (state.guessLatLng) {
      distance = calculateDistanceInMeters(state.guessLatLng, v.coordinates);
      points = calculateScore(distance);
      points = Math.round(points * Math.pow(1 - CONFIG.HINT_PENALTY, state.current.hintsBought));
      // Found it on foot: automatic check-in with double check-in XP
      if (state.playMode === "street" && state.guessFromGps && distance <= CONFIG.CHECKIN_RADIUS_METERS + Math.min(25, state.gps.accuracy || 0)) {
        inPerson = Progress.checkIn(v, true);
        if (inPerson) rewardToast("Found it in person", inPerson);
      }
    }
    state.totalScore += points;
    state.results.push({ venue: v, distance, points, perfect: distance !== null && distance <= v.gameplay.points_thresholds.perfect });
    reportRace(state.results.length === state.rounds.length);
    showResult(v, distance, points, timedOut && !state.guessLatLng);
  }

  function showResult(v, distance, points, noGuess) {
    show("screen-result");
    if (!resultMap) {
      resultMap = L.map("result-map", { zoomControl: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(resultMap);
      resultMap._layersToClear = [];
    }
    resultMap._layersToClear.forEach(l => resultMap.removeLayer(l));
    resultMap._layersToClear = [];
    resultMap.invalidateSize();

    const target = L.marker([v.coordinates.lat, v.coordinates.lng], { icon: pinIcon("pin-target") }).addTo(resultMap);
    resultMap._layersToClear.push(target);
    if (state.guessLatLng) {
      const g = L.marker([state.guessLatLng.lat, state.guessLatLng.lng], { icon: pinIcon("pin-guess") }).addTo(resultMap);
      const line = L.polyline([[state.guessLatLng.lat, state.guessLatLng.lng], [v.coordinates.lat, v.coordinates.lng]],
        { color: "#ff2e93", weight: 3, dashArray: "6 8" }).addTo(resultMap);
      resultMap._layersToClear.push(g, line);
      // Leave room at the bottom for the result card
      resultMap.fitBounds(line.getBounds(), { paddingTopLeft: [40, 40], paddingBottomRight: [40, 380], maxZoom: 18 });
    } else {
      resultMap.setView([v.coordinates.lat, v.coordinates.lng], 16);
    }

    $("res-rating").textContent = noGuess ? "No guess" : ratingFor(distance, v.gameplay.points_thresholds);
    $("res-name").textContent = v.name;
    $("res-meta").textContent = v.type + " · " + (v.address || v.district_name);
    $("res-distance").textContent = distance === null ? "—" : formatDistance(distance);
    $("res-points").textContent = points.toLocaleString();
    $("res-bar").style.width = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { $("res-bar").style.width = (points / 50) + "%"; }));

    const open = Progress.openStatus(v);
    $("res-open").textContent = Progress.openLabel(v) ? Progress.openLabel(v) + " (sample hours)" : "";
    $("res-open").classList.toggle("open", !!(open && open.open));

    // Pub crawl: this find reveals the next stop's clue
    const next = state.game === "crawl" ? state.rounds[state.roundIndex + 1] : null;
    $("res-next").classList.toggle("hidden", !next);
    if (next) {
      $("res-next").innerHTML = "";
      const b = document.createElement("b");
      b.textContent = "Next stop: ";
      $("res-next").append(b, next.gameplay.clue_hint + " (" + formatDistance(calculateDistanceInMeters(v.coordinates, next.coordinates)) + " walk)");
    }
    if (!state.race) $("res-board").classList.add("hidden");
    else renderRaceBoards();

    $("btn-next").textContent = state.roundIndex + 1 < state.rounds.length
      ? (state.game === "crawl" ? "Walk to the next stop" : "Next venue")
      : "See final score";
  }

  function nextRound() {
    state.roundIndex++;
    if (state.roundIndex >= state.rounds.length) return showFinal();
    show("screen-game");
    startRound();
  }

  async function showFinal() {
    stopSensors();
    $("race-live").classList.add("hidden");
    show("screen-final");
    const max = state.rounds.length * 5000;
    $("final-score").textContent = state.totalScore.toLocaleString();
    $("final-sub").textContent = GAME_NAMES[state.game] + (state.game === "daily" ? " #" + Progress.dailyNumber() : "") +
      " · out of " + max.toLocaleString() + " points";
    const list = $("final-list");
    list.innerHTML = "";
    state.results.forEach(r => {
      const li = document.createElement("li");
      li.append(r.venue.name + " · " + (r.distance === null ? "no guess" : formatDistance(r.distance)) + " · ");
      const b = document.createElement("b");
      b.textContent = r.points.toLocaleString();
      li.appendChild(b);
      list.appendChild(li);
    });

    // A race counts as won if you top a live board with at least one friend on it
    let won = false;
    if (state.race) {
      if (Race.isLive()) {
        const players = await Race.leaderboard(state.race.code);
        state.race.players = players;
        won = players.length >= 2 && players[0].id === Progress.profile.id;
        renderRaceBoards();
      } else {
        renderRaceBoards();
      }
    } else {
      $("final-board").classList.add("hidden");
    }

    const reward = Progress.finishGame(state.game, state.results, { won });
    const xpTotal = reward.xp + state.earned.xp;
    const badges = state.earned.badges.concat(reward.badges);
    let xpLine = "<b>+" + xpTotal.toLocaleString() + " XP</b>";
    if (reward.levelUp) xpLine += " · Level up! You're level " + reward.levelUp;
    if (state.game === "daily") xpLine += " · 🔥 " + reward.streak + "-day streak";
    const mult = Progress.xpMultiplier();
    if (mult > 1) xpLine += " · " + mult.toFixed(2).replace(/\.?0+$/, "") + "x bonus";
    $("final-xp").innerHTML = xpLine;
    const fb = $("final-badges");
    fb.innerHTML = "";
    badges.forEach(b => fb.appendChild(badgeEl(b, false)));

    if (state.race && state.race.stopWatch) state.race.stopWatch();
    renderHub();
  }

  function shareText() {
    const squares = state.results.map(r => r.points >= 4000 ? "🟩" : r.points >= 1500 ? "🟨" : "🟥").join("");
    const score = state.totalScore.toLocaleString() + "/" + (state.rounds.length * 5000).toLocaleString();
    const how = state.playMode === "street" ? " (on the street)" : "";
    if (state.game === "daily") {
      return "Blackpool After Dark Daily #" + Progress.dailyNumber() + " 🍸 " + score + "\n" + squares + " 🔥" + Progress.profile.streak;
    }
    if (state.race) return "Blackpool After Dark race " + state.race.code + how + " 🏁 " + score + "\n" + squares + "\nBeat me: enter code " + state.race.code;
    return "Blackpool After Dark " + GAME_NAMES[state.game] + how + " 🍸 " + score + "\n" + squares;
  }

  async function copyShare(text) {
    try { await navigator.clipboard.writeText(text); toast("Result copied"); }
    catch (e) { toast(text); }
  }

  function shareDaily() {
    const played = Progress.dailyPlayed();
    const squares = played.results.map(p => p >= 4000 ? "🟩" : p >= 1500 ? "🟨" : "🟥").join("");
    copyShare("Blackpool After Dark Daily #" + Progress.dailyNumber() + " 🍸 " + played.score.toLocaleString() + "/" +
      (played.results.length * 5000).toLocaleString() + "\n" + squares + " 🔥" + Progress.profile.streak);
  }

  // ==========================================
  // 14. WIRING
  // ==========================================
  function wire() {
    document.querySelectorAll("#mode-picker .seg").forEach(btn => btn.addEventListener("click", () => {
      document.querySelectorAll("#mode-picker .seg").forEach(b => b.classList.toggle("active", b === btn));
      state.playMode = btn.dataset.mode;
    }));
    document.querySelectorAll("#game-picker .gcard").forEach(btn => btn.addEventListener("click", () => {
      state.game = btn.dataset.game;
      renderGamePicker();
    }));
    $("btn-race-new").addEventListener("click", newRaceCode);
    $("district-select").addEventListener("change", () => { if (state.game === "race") newRaceCode(); });
    $("race-code").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase(); });

    $("btn-profile").addEventListener("click", () => { renderProfile(); $("modal-profile").classList.remove("hidden"); });
    $("btn-close-profile").addEventListener("click", () => {
      Progress.setName($("input-name").value);
      $("modal-profile").classList.add("hidden");
      renderHub();
    });

    $("btn-start").addEventListener("click", startGame);
    $("btn-guess").addEventListener("click", () => submitGuess(false));
    $("btn-next").addEventListener("click", nextRound);
    $("btn-hint").addEventListener("click", buyHint);
    $("btn-return").addEventListener("click", returnToStart);
    $("btn-here").addEventListener("click", pinMyLocation);
    $("checkin-chip").addEventListener("click", onCheckinTap);
    $("btn-camera").addEventListener("click", () => state.cameraStream ? stopCamera() : startCamera());
    $("blend").addEventListener("input", applyBlend);
    $("btn-again").addEventListener("click", () => { renderHub(); show("screen-start"); });
    $("btn-toggle-map").addEventListener("click", () => {
      $("guess-wrap").classList.toggle("expanded");
      setTimeout(() => guessMap.invalidateSize(), 60);
    });
    $("btn-share").addEventListener("click", () => copyShare(shareText()));

    $("btn-settings").addEventListener("click", () => {
      $("input-key").value = settings.apiKey;
      $("input-time").value = settings.roundTime;
      $("modal-settings").classList.remove("hidden");
    });
    $("btn-close-settings").addEventListener("click", () => $("modal-settings").classList.add("hidden"));
    $("btn-save-settings").addEventListener("click", () => {
      const newKey = $("input-key").value.trim();
      const keyChanged = newKey !== settings.apiKey;
      settings.apiKey = newKey;
      settings.roundTime = Math.max(30, Math.min(600, Number($("input-time").value) || CONFIG.ROUND_TIME_SECONDS));
      saveSettings();
      $("modal-settings").classList.add("hidden");
      // Google Maps can only be loaded once per page, so reload to apply a new key
      if (keyChanged) location.reload();
    });

    // Keyboard: Enter locks in the guess, Enter/Space moves to the next round.
    // Arrow keys are left to Street View, which uses them to walk and turn.
    document.addEventListener("keydown", e => {
      if ($("screen-game").classList.contains("active") && e.key === "Enter" && !$("btn-guess").disabled) submitGuess(false);
      else if ($("screen-result").classList.contains("active") && (e.key === "Enter" || e.key === " ")) nextRound();
    });
  }

  initHub();
  wire();
  initGoogle();
})();
