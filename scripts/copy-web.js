// Copies the game files into www/ so Capacitor can bundle them into the app.
// Put the game files (index.html, app.js, game.js, ...) in ../game, or set GAME_DIR.
const fs = require("fs");
const path = require("path");
const src = process.env.GAME_DIR || path.join(__dirname, "..", "game");
const dest = path.join(__dirname, "..", "www");
const skip = new Set(["screenshots", "README.md", "sw.js"]);
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: p => !skip.has(path.basename(p)) });
console.log("Copied game from " + src + " to www/");
