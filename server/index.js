const express = require("express");
const cors = require("cors");
const {
  GAME_CONFIG,
  tickState,
  queueBuilding,
  marketBuy,
  marketSell,
  systemStoreSell,
  completeContract,
  startResearch
} = require("./gameEngine");
const { createSession, getSession, updateSession, readDb, withDbUpdate } = require("./store");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

function requireSession(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });

  const session = getSession(token);
  if (!session) return res.status(401).json({ error: "invalid_token" });

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
  const known = [
    "insufficient_resources",
    "insufficient_gold",
    "unknown_building",
    "invalid_market_order",
    "unknown_contract",
    "contract_already_done",
    "contract_locked",
    "shop_not_unlocked",
    "unknown_research",
    "research_maxed",
    "research_busy",
    "offer_not_found"
  ];

  if (known.includes(error.message)) {
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
  res.json({ state: updated.state, company: { name: updated.displayName } });
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

app.post("/api/actions/market/buy", requireSession, (req, res) => {
  try {
    const { resource, amount } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      marketBuy(state, resource, amount);
    });
    res.status(200).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/market/sell", requireSession, (req, res) => {
  try {
    const { resource, amount } = req.body;
    let payout = 0;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      payout = marketSell(state, resource, amount);
    });
    res.status(200).json({ state: updated.state, payout });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/system-store/sell", requireSession, (req, res) => {
  try {
    const { resource, amount } = req.body;
    let payout = 0;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      payout = systemStoreSell(state, resource, amount);
    });
    res.status(200).json({ state: updated.state, payout });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/contracts/complete", requireSession, (req, res) => {
  try {
    const { contractId } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      completeContract(state, contractId);
    });
    res.status(200).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/research/start", requireSession, (req, res) => {
  try {
    const { researchKey } = req.body;
    const updated = withStateUpdate(req.sessionToken, (state) => {
      startResearch(state, researchKey);
    });
    res.status(200).json({ state: updated.state });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.get("/api/player-market/offers", requireSession, (_req, res) => {
  const db = readDb();
  const offers = db.marketOffers
    .slice(-100)
    .reverse()
    .map((offer) => ({
      offerId: offer.offerId,
      sellerName: offer.sellerName,
      offeredResource: offer.offeredResource,
      offeredAmount: offer.offeredAmount,
      requestedResource: offer.requestedResource,
      requestedAmount: offer.requestedAmount,
      createdAt: offer.createdAt
    }));

  res.json({ offers });
});

app.post("/api/actions/player-market/create-offer", requireSession, (req, res) => {
  try {
    const { offeredResource, offeredAmount, requestedResource, requestedAmount } = req.body;
    const sellAmount = Number(offeredAmount);
    const wantAmount = Number(requestedAmount);

    if (![sellAmount, wantAmount].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error("invalid_market_order");
    }

    const result = withDbUpdate((db) => {
      const seller = db.sessions[req.sessionToken];
      seller.state = tickState(seller.state);

      if ((seller.state.resources[offeredResource] || 0) < sellAmount) {
        throw new Error("insufficient_resources");
      }

      seller.state.resources[offeredResource] -= sellAmount;

      const offer = {
        offerId: db.nextOfferId++,
        sellerToken: req.sessionToken,
        sellerName: seller.displayName,
        offeredResource,
        offeredAmount: sellAmount,
        requestedResource,
        requestedAmount: wantAmount,
        createdAt: Date.now()
      };

      db.marketOffers.push(offer);
      return db;
    });

    const offer = result.marketOffers[result.marketOffers.length - 1];
    res.status(201).json({ offer });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.post("/api/actions/player-market/accept-offer", requireSession, (req, res) => {
  try {
    const { offerId } = req.body;

    const result = withDbUpdate((db) => {
      const buyer = db.sessions[req.sessionToken];
      buyer.state = tickState(buyer.state);

      const index = db.marketOffers.findIndex((offer) => offer.offerId === Number(offerId));
      if (index === -1) throw new Error("offer_not_found");

      const offer = db.marketOffers[index];
      if (offer.sellerToken === req.sessionToken) throw new Error("invalid_market_order");

      if ((buyer.state.resources[offer.requestedResource] || 0) < offer.requestedAmount) {
        throw new Error("insufficient_resources");
      }

      const seller = db.sessions[offer.sellerToken];
      if (!seller) throw new Error("offer_not_found");
      seller.state = tickState(seller.state);

      buyer.state.resources[offer.requestedResource] -= offer.requestedAmount;
      buyer.state.resources[offer.offeredResource] = (buyer.state.resources[offer.offeredResource] || 0) + offer.offeredAmount;

      seller.state.resources[offer.requestedResource] = (seller.state.resources[offer.requestedResource] || 0) + offer.requestedAmount;

      db.marketOffers.splice(index, 1);
      return db;
    });

    const ownState = result.sessions[req.sessionToken].state;
    res.status(200).json({ state: ownState });
  } catch (error) {
    const mapped = mapEngineError(error);
    res.status(mapped.status).json({ error: mapped.error });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Kapiland-Style API läuft auf http://localhost:${PORT}`);
});
