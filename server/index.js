const express = require("express");
const cors = require("cors");
const {
  GAME_CONFIG,
  tickState,
  queueBuilding,
  queueUnit,
  performTrade,
  simulateAttack
} = require("./gameEngine");
const { createSession, getSession, updateSession } = require("./store");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

function requireSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "missing_token" });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "invalid_token" });
  }

  req.sessionToken = token;
  req.session = session;
  return next();
}

function withStateUpdate(token, handler) {
  return updateSession(token, (session) => {
    const mutable = {
      ...session,
      state: tickState(session.state)
    };

    handler(mutable.state);
    return mutable;
  });
}

function mapEngineError(error) {
  if (error.message === "insufficient_resources") {
    return { status: 400, error: "insufficient_resources" };
  }

  if (
    error.message === "unknown_building" ||
    error.message === "unknown_unit" ||
    error.message === "unknown_trade" ||
    error.message === "invalid_target"
  ) {
    return { status: 400, error: error.message };
  }

  return { status: 500, error: "internal_error" };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/anonymous", (_req, res) => {
  const token = createSession();
  res.status(201).json({ token });
});

app.get("/api/config", (_req, res) => {
  res.json({ config: GAME_CONFIG });
});

app.get("/api/state", requireSession, (req, res) => {
  const updated = withStateUpdate(req.sessionToken, () => {});
  res.json({ state: updated.state });
});

app.post("/api/actions/build", requireSession, (req, res) => {
  try {
    const { buildingKey } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      queueBuilding(state, buildingKey);
    });

    res.status(201).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/train", requireSession, (req, res) => {
  try {
    const { unitKey } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      queueUnit(state, unitKey);
    });

    res.status(201).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/trade", requireSession, (req, res) => {
  try {
    const { recipe } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      performTrade(state, recipe);
    });

    res.status(200).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/attack", requireSession, (req, res) => {
  try {
    const { targetLevel } = req.body;
    let battleResult = null;

    const updated = withStateUpdate(req.sessionToken, (state) => {
      battleResult = simulateAttack(state, targetLevel);
    });

    res.status(200).json({ state: updated.state, battleResult });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Game API läuft auf http://localhost:${PORT}`);
});
