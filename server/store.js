const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { createNewState } = require("./gameEngine");

const DB_PATH = path.join(__dirname, "data", "game.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ sessions: {} }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function createSession() {
  const db = readDb();
  const token = randomUUID();
  db.sessions[token] = {
    createdAt: Date.now(),
    state: createNewState()
  };
  writeDb(db);
  return token;
}

function getSession(token) {
  const db = readDb();
  return db.sessions[token] || null;
}

function updateSession(token, updater) {
  const db = readDb();
  const existing = db.sessions[token];
  if (!existing) {
    return null;
  }

  const next = updater(existing);
  db.sessions[token] = next;
  writeDb(db);
  return next;
}

module.exports = {
  createSession,
  getSession,
  updateSession
};
