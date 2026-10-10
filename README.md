# Blackpool After Dark

A nightlife GeoGuessr for 40 Blackpool venues.

## Play
Keep all files in one folder and open `index.html` in a browser. You need an internet connection for the maps.
Put it on any https website and Chrome on Android offers to install it like an app. There's also an Android app project in `../game-android`.

## Turn on Street View
1. Get a Google Maps API key at https://console.cloud.google.com/google/maps-apis and enable **Maps JavaScript API**.
2. Paste it into `config.js`, or into **Settings** on the start screen.

Without a key the game runs in **Clue Mode**: you get written clues and the guess map, but no Street View.

## Pick a game
- **Daily Challenge:** 3 venues, the same for everyone that day. Builds your 🔥 streak. Once it's played, the button copies your result to share.
- **Quick Crawl:** 5 random venues.
- **Pub Crawl:** a walking route of 5 venues. Each find reveals the next stop's clue, and at home you start each leg from the venue you just found.
- **Race Friends:** everyone who types the same 5-character code gets the same venues. The last digit picks the district (0 = all of Blackpool).

## Pick how you play
- **At home:** walk anywhere in Street View. Tap the arrows or the road, or use the arrow keys. "Back to start" returns you to the drop point.
- **On the street:** your phone's GPS moves Street View with you and the compass turns it as you turn. "Camera on" shows the live camera with Street View laid over it (the slider sets how see-through it is). Quick Crawl and Pub Crawl use the venues nearest to you, open ones first.

## Rounds
- The **venue scanner** (radar) gets stronger as you face the venue. Hold on it to decode the clue for free.
- **Buy hint** reveals the district, then the street. Each costs 25% of that round's points.
- Drop a pin and lock it in. Up to 5,000 points per round, based on distance.

## Progress
One profile ties every mode together (tap the level bar on the start screen):
- **XP and levels** from every round, plus bonuses for finishing a Daily, a Pub Crawl or a race.
- **Badges** for streaks, perfect guesses, crawls, races, check-ins, seasonal events and more.
- **Check-ins:** on the street, a "Check in" button appears when you're within 35 m of any venue (+150 XP). Find the mystery venue itself and tap "You found it!" for an automatic check-in at double XP and the "Found It In Person" badge. Check in at every venue in a district for its Local badge.
- **Night owl bonus:** +10% XP between 8pm and 4am.
- **Seasonal events** (Illuminations, Pride, Halloween, New Year's Eve) change the colours, boost XP and award a badge.

Your profile is saved in your browser on this device.

## Live race leaderboard (optional, free)
Without this, races still work: everyone gets the same venues and compares shared results.
1. Go to https://console.firebase.google.com and create a project (Google Analytics not needed).
2. In **Build > Realtime Database**, click **Create database**, pick a location and choose **Start in test mode**.
3. Copy the database URL (it looks like `https://your-project-default-rtdb.europe-west1.firebasedatabase.app`) into `FIREBASE_DB_URL` in `config.js`.
4. Test mode expires after 30 days. To keep it running, set the rules (Realtime Database > Rules) to:
   ```json
   { "rules": { "races": { "$code": { ".read": true, ".write": true } }, ".read": false, ".write": false } }
   ```

## Things to edit in config.js
- `OPENING_HOURS_BY_TYPE` / `OPENING_HOURS_BY_VENUE`: the opening hours are **placeholders** based on venue type. Replace them with each venue's real hours.
- `EVENTS`: seasonal event dates are **placeholders**. Check them each year.
- Round counts, timers, hint cost, check-in distance and the night bonus.

## Files
- `app.js`: venue database and scoring engine
- `progress.js`: profile, XP, badges, check-ins, opening hours, events
- `race.js`: race codes and the live leaderboard
- `game.js`: game loop, Street View, scanner, sensors, maps
- `config.js`: keys and settings
- `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`: the page and app install
