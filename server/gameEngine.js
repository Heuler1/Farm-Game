const { GAME_CONFIG } = require("./gameConfig");

function createNewState() {
  return {
    lastTick: Date.now(),
    resources: {
      wood: 180,
      grain: 140,
      flour: 20,
      bread: 10,
      iron: 40,
      tools: 10,
      gold: 800
    },
    buildings: {
      lumbercamp: 1,
      farm: 1,
      mine: 1,
      mill: 1,
      bakery: 0,
      workshop: 0,
      supermarket: 0
    },
    queue: [],
    stats: {
      buildingsConstructed: 0,
      contractsCompleted: 0,
      marketVolume: 0,
      contractCycles: 0
    },
    research: {
      levels: Object.fromEntries(Object.keys(GAME_CONFIG.research).map((key) => [key, 0])),
      queue: []
    },
    contracts: GAME_CONFIG.contracts.map((contract) => ({ ...contract, done: false }))
  };
}

function tickState(state, now = Date.now()) {
  const deltaSec = Math.max(1, Math.floor((now - state.lastTick) / 1000));
  state.lastTick = now;

  produceRawResources(state, deltaSec);
  runRecipeBuildings(state, deltaSec);
  processQueue(state, now);
  processResearchQueue(state, now);
  return state;
}

function productionMultiplier(state) {
  return 1 + (state.research.levels.production_efficiency || 0) * 0.05;
}

function logisticsMultiplier(state) {
  return Math.max(0.35, 1 - (state.research.levels.logistics || 0) * 0.03);
}

function sellPriceMultiplier(state) {
  return 1 + (state.research.levels.trade_negotiation || 0) * 0.02;
}

function contractRewardMultiplier(state) {
  return 1 + (state.research.levels.contract_management || 0) * 0.04;
}

function produceRawResources(state, deltaSec) {
  const prodMulti = productionMultiplier(state);
  for (const [buildingKey, level] of Object.entries(state.buildings)) {
    const definition = GAME_CONFIG.buildings[buildingKey];
    if (!definition?.baseOutputPerHour || level <= 0) continue;

    for (const [resource, amountPerHour] of Object.entries(definition.baseOutputPerHour)) {
      const perSecond = ((amountPerHour * level) / 3600) * prodMulti;
      state.resources[resource] += perSecond * deltaSec;
    }
  }
}

function runRecipeBuildings(state, deltaSec) {
  const prodMulti = productionMultiplier(state);

  for (const [buildingKey, level] of Object.entries(state.buildings)) {
    const definition = GAME_CONFIG.buildings[buildingKey];
    if (!definition?.recipePerHour || level <= 0) continue;

    const cycles = (deltaSec / 3600) * level * prodMulti;
    const desiredInput = scaleMap(definition.recipePerHour.input, cycles);
    const ratio = affordableRatio(state.resources, desiredInput);
    if (ratio <= 0) continue;

    const usedInput = scaleMap(desiredInput, ratio);
    const producedOutput = scaleMap(scaleMap(definition.recipePerHour.output, cycles), ratio);

    subtractResources(state.resources, usedInput);
    addResources(state.resources, producedOutput);
  }
}

function processQueue(state, now) {
  const ready = state.queue.filter((item) => item.completeAt <= now);
  if (!ready.length) return;

  state.queue = state.queue.filter((item) => item.completeAt > now);
  for (const item of ready) {
    if (item.type === "building") {
      state.buildings[item.key] += 1;
      state.stats.buildingsConstructed += 1;
    }
  }
}

function processResearchQueue(state, now) {
  const ready = state.research.queue.filter((item) => item.completeAt <= now);
  if (!ready.length) return;

  state.research.queue = state.research.queue.filter((item) => item.completeAt > now);
  for (const entry of ready) {
    state.research.levels[entry.key] += 1;
  }
}

function scaleMap(map, factor) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value * factor]));
}

function affordableRatio(resources, neededInput) {
  let ratio = 1;
  for (const [resource, needed] of Object.entries(neededInput)) {
    if (needed <= 0) continue;
    ratio = Math.min(ratio, (resources[resource] || 0) / needed);
  }
  return Math.max(0, Math.min(1, ratio));
}

function subtractResources(resources, costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    resources[resource] = (resources[resource] || 0) - amount;
  }
}

function addResources(resources, gains) {
  for (const [resource, amount] of Object.entries(gains)) {
    resources[resource] = (resources[resource] || 0) + amount;
  }
}

function scaledCost(baseCost, level) {
  const factor = Math.pow(1.35, level);
  return Object.fromEntries(Object.entries(baseCost).map(([resource, amount]) => [resource, Math.ceil(amount * factor)]));
}

function canAfford(resources, cost) {
  return Object.entries(cost).every(([resource, amount]) => (resources[resource] || 0) >= amount);
}

function queueBuilding(state, buildingKey) {
  const definition = GAME_CONFIG.buildings[buildingKey];
  if (!definition) throw new Error("unknown_building");

  const level = state.buildings[buildingKey] || 0;
  const cost = scaledCost(definition.baseCost, level);
  if (!canAfford(state.resources, cost)) throw new Error("insufficient_resources");

  subtractResources(state.resources, cost);
  const timeMulti = logisticsMultiplier(state);
  state.queue.push({
    type: "building",
    key: buildingKey,
    completeAt: Date.now() + Math.ceil(definition.baseTimeSec * timeMulti) * 1000
  });
}

function marketBuy(state, resource, amount) {
  const price = GAME_CONFIG.marketPrices[resource];
  const qty = Number(amount);
  if (!price || !Number.isFinite(qty) || qty <= 0) throw new Error("invalid_market_order");

  const total = price.buy * qty;
  if (state.resources.gold < total) throw new Error("insufficient_gold");

  state.resources.gold -= total;
  state.resources[resource] += qty;
  state.stats.marketVolume += qty;
}

function marketSell(state, resource, amount) {
  const price = GAME_CONFIG.marketPrices[resource];
  const qty = Number(amount);
  if (!price || !Number.isFinite(qty) || qty <= 0) throw new Error("invalid_market_order");
  if ((state.resources[resource] || 0) < qty) throw new Error("insufficient_resources");

  state.resources[resource] -= qty;
  const payout = Math.floor(price.sell * qty * sellPriceMultiplier(state));
  state.resources.gold += payout;
  state.stats.marketVolume += qty;
  return payout;
}

function systemStoreSell(state, resource, amount) {
  if ((state.buildings.supermarket || 0) <= 0) throw new Error("shop_not_unlocked");
  return marketSell(state, resource, amount);
}

function tierFromProgress(state) {
  return 1 + Math.floor(state.stats.contractsCompleted / 4);
}

function completeContract(state, contractId) {
  const contract = state.contracts.find((entry) => entry.id === contractId);
  if (!contract) throw new Error("unknown_contract");
  if (contract.done) throw new Error("contract_already_done");
  if (contract.tier > tierFromProgress(state)) throw new Error("contract_locked");
  if (!canAfford(state.resources, contract.needs)) throw new Error("insufficient_resources");

  subtractResources(state.resources, contract.needs);
  addResources(state.resources, scaleMap(contract.reward, contractRewardMultiplier(state)));
  contract.done = true;
  state.stats.contractsCompleted += 1;

  const activeContracts = state.contracts.filter((entry) => entry.tier <= tierFromProgress(state));
  if (activeContracts.length > 0 && activeContracts.every((entry) => entry.done)) {
    for (const entry of activeContracts) {
      entry.done = false;
    }
    state.stats.contractCycles += 1;
  }
}

function startResearch(state, researchKey) {
  const definition = GAME_CONFIG.research[researchKey];
  if (!definition) throw new Error("unknown_research");

  const level = state.research.levels[researchKey] || 0;
  if (level >= definition.maxLevel) throw new Error("research_maxed");
  if (state.research.queue.length >= 1) throw new Error("research_busy");

  const cost = scaledCost(definition.baseCost, level);
  if (!canAfford(state.resources, cost)) throw new Error("insufficient_resources");

  subtractResources(state.resources, cost);
  state.research.queue.push({
    key: researchKey,
    completeAt: Date.now() + Math.ceil(definition.baseTimeSec * Math.pow(1.15, level)) * 1000
  });
}

module.exports = {
  GAME_CONFIG,
  createNewState,
  tickState,
  queueBuilding,
  marketBuy,
  marketSell,
  systemStoreSell,
  completeContract,
  startResearch,
  canAfford,
  addResources,
  subtractResources
};
