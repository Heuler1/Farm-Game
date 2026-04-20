const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { createNewState } = require("./gameEngine");

const DB_PATH = path.join(__dirname, "data", "game.json");

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ sessions: {}, marketOffers: [], nextOfferId: 1 }, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return {
    sessions: parsed.sessions || {},
    marketOffers: parsed.marketOffers || [],
    nextOfferId: parsed.nextOfferId || 1
  };
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function withDbUpdate(updater) {
  const db = readDb();
  const next = updater(db);
  writeDb(next);
  return next;
}

function createSession() {
  const token = randomUUID();
  withDbUpdate((db) => {
    db.sessions[token] = {
      createdAt: Date.now(),
      displayName: `Firma-${token.slice(0, 6)}`,
      state: createNewState()
    };
    return db;
  });

  return token;
}

function getSession(token) {
  const db = readDb();
  return db.sessions[token] || null;
}

function updateSession(token, updater) {
  const db = readDb();
  const existing = db.sessions[token];
  if (!existing) return null;

  db.sessions[token] = updater(existing);
  writeDb(db);
  return db.sessions[token];
}

module.exports = {
  readDb,
  withDbUpdate,
  createSession,
  getSession,
  updateSession
};
