const http = require("http");
const { URL } = require("url");
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

const PORT = Number(process.env.PORT || 4000);

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("payload_too_large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function extractToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
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
    "offer_not_found",
    "invalid_json",
    "payload_too_large"
  ];

  if (known.includes(error.message)) {
    return { status: 400, error: error.message };
  }

  return { status: 500, error: "internal_error" };
}

function requireSession(req) {
  const token = extractToken(req);
  if (!token) return { error: "missing_token" };
  const session = getSession(token);
  if (!session) return { error: "invalid_token" };
  return { token, session };
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { error: "bad_request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && path === "/api/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && path === "/api/auth/anonymous") {
      const token = createSession();
      json(res, 201, { token });
      return;
    }

    if (req.method === "GET" && path === "/api/config") {
      json(res, 200, { config: GAME_CONFIG });
      return;
    }

    if (req.method === "GET" && path === "/api/state") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const updated = withStateUpdate(auth.token, () => {});
      json(res, 200, { state: updated.state, company: { name: updated.displayName } });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/build") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const updated = withStateUpdate(auth.token, (state) => {
        queueBuilding(state, body.buildingKey);
      });

      json(res, 201, { state: updated.state });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/market/buy") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const updated = withStateUpdate(auth.token, (state) => {
        marketBuy(state, body.resource, body.amount);
      });

      json(res, 200, { state: updated.state });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/market/sell") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);
      let payout = 0;

      const updated = withStateUpdate(auth.token, (state) => {
        payout = marketSell(state, body.resource, body.amount);
      });

      json(res, 200, { state: updated.state, payout });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/system-store/sell") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);
      let payout = 0;

      const updated = withStateUpdate(auth.token, (state) => {
        payout = systemStoreSell(state, body.resource, body.amount);
      });

      json(res, 200, { state: updated.state, payout });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/contracts/complete") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const updated = withStateUpdate(auth.token, (state) => {
        completeContract(state, body.contractId);
      });

      json(res, 200, { state: updated.state });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/research/start") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const updated = withStateUpdate(auth.token, (state) => {
        startResearch(state, body.researchKey);
      });

      json(res, 200, { state: updated.state });
      return;
    }

    if (req.method === "GET" && path === "/api/player-market/offers") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });

      const db = readDb();
      const offers = db.marketOffers.slice(-100).reverse().map((offer) => ({
        offerId: offer.offerId,
        sellerName: offer.sellerName,
        offeredResource: offer.offeredResource,
        offeredAmount: offer.offeredAmount,
        requestedResource: offer.requestedResource,
        requestedAmount: offer.requestedAmount,
        createdAt: offer.createdAt
      }));

      json(res, 200, { offers });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/player-market/create-offer") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const sellAmount = Number(body.offeredAmount);
      const wantAmount = Number(body.requestedAmount);
      if (![sellAmount, wantAmount].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error("invalid_market_order");
      }

      const result = withDbUpdate((db) => {
        const seller = db.sessions[auth.token];
        seller.state = tickState(seller.state);

        if ((seller.state.resources[body.offeredResource] || 0) < sellAmount) {
          throw new Error("insufficient_resources");
        }

        seller.state.resources[body.offeredResource] -= sellAmount;

        const offer = {
          offerId: db.nextOfferId++,
          sellerToken: auth.token,
          sellerName: seller.displayName,
          offeredResource: body.offeredResource,
          offeredAmount: sellAmount,
          requestedResource: body.requestedResource,
          requestedAmount: wantAmount,
          createdAt: Date.now()
        };

        db.marketOffers.push(offer);
        return db;
      });

      json(res, 201, { offer: result.marketOffers[result.marketOffers.length - 1] });
      return;
    }

    if (req.method === "POST" && path === "/api/actions/player-market/accept-offer") {
      const auth = requireSession(req);
      if (auth.error) return json(res, 401, { error: auth.error });
      const body = await parseBody(req);

      const result = withDbUpdate((db) => {
        const buyer = db.sessions[auth.token];
        buyer.state = tickState(buyer.state);

        const index = db.marketOffers.findIndex((offer) => offer.offerId === Number(body.offerId));
        if (index === -1) throw new Error("offer_not_found");

        const offer = db.marketOffers[index];
        if (offer.sellerToken === auth.token) throw new Error("invalid_market_order");
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

      json(res, 200, { state: result.sessions[auth.token].state });
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (error) {
    const mapped = mapEngineError(error);
    json(res, mapped.status, { error: mapped.error });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Kapiland-Style API läuft auf http://localhost:${PORT}`);
});
