const { GAME_CONFIG } = require("./gameConfig");

function createNewState() {
  return {
    lastTick: Date.now(),
    resources: {
      wood: 600,
      stone: 450,
      food: 500,
      iron: 250,
      gold: 150
    },
    productionPerHour: {
      wood: 80,
      stone: 60,
      food: 70,
      iron: 35,
      gold: 10
    },
    buildings: {
      lumberyard: 1,
      quarry: 1,
      farm: 1,
      ironMine: 1,
      wall: 0,
      tower: 0
    },
    army: {
      spearman: 3,
      swordsman: 2,
      archer: 2,
      ram: 0
    },
    queue: [],
    stats: {
      buildingsConstructed: 0,
      unitsTrained: 7,
      battlesWon: 0
    },
    quests: GAME_CONFIG.quests.map((quest) => ({ ...quest, done: false }))
  };
}

function tickState(state, now = Date.now()) {
  const deltaSec = Math.max(1, Math.floor((now - state.lastTick) / 1000));
  state.lastTick = now;

  for (const resource of GAME_CONFIG.resources) {
    const perSec = (state.productionPerHour[resource] || 0) / 3600;
    state.resources[resource] += perSec * deltaSec;
  }

  processQueue(state, now);
  evaluateQuests(state);

  return state;
}

function processQueue(state, now) {
  const ready = state.queue.filter((item) => item.completeAt <= now);
  if (!ready.length) {
    return;
  }

  state.queue = state.queue.filter((item) => item.completeAt > now);

  for (const item of ready) {
    if (item.type === "building") {
      state.buildings[item.key] += 1;
      state.stats.buildingsConstructed += 1;
      applyBuildingEffects(state, item.key);
    }

    if (item.type === "unit") {
      state.army[item.key] += 1;
      state.stats.unitsTrained += 1;
    }
  }
}

function applyBuildingEffects(state, buildingKey) {
  const definition = GAME_CONFIG.buildings[buildingKey];
  if (!definition || !definition.productionBoost) {
    return;
  }

  for (const [resource, boost] of Object.entries(definition.productionBoost)) {
    state.productionPerHour[resource] += boost;
  }
}

function scaledCost(baseCost, level) {
  const factor = Math.pow(1.35, level);
  return Object.fromEntries(Object.entries(baseCost).map(([resource, amount]) => [resource, Math.ceil(amount * factor)]));
}

function canAfford(resources, cost) {
  return Object.entries(cost).every(([resource, amount]) => resources[resource] >= amount);
}

function pay(resources, cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource] -= amount;
  }
}

function queueBuilding(state, buildingKey) {
  const definition = GAME_CONFIG.buildings[buildingKey];
  if (!definition) {
    throw new Error("unknown_building");
  }

  const level = state.buildings[buildingKey] || 0;
  const cost = scaledCost(definition.baseCost, level);

  if (!canAfford(state.resources, cost)) {
    throw new Error("insufficient_resources");
  }

  pay(state.resources, cost);
  state.queue.push({
    type: "building",
    key: buildingKey,
    completeAt: Date.now() + definition.baseTimeSec * 1000
  });
}

function queueUnit(state, unitKey) {
  const definition = GAME_CONFIG.units[unitKey];
  if (!definition) {
    throw new Error("unknown_unit");
  }

  if (!canAfford(state.resources, definition.cost)) {
    throw new Error("insufficient_resources");
  }

  pay(state.resources, definition.cost);
  state.queue.push({
    type: "unit",
    key: unitKey,
    completeAt: Date.now() + definition.trainSec * 1000
  });
}

function performTrade(state, recipe) {
  const recipes = {
    "wood-stone": { cost: { wood: 100 }, reward: { stone: 70 } },
    "wood-iron": { cost: { wood: 100 }, reward: { iron: 60 } }
  };

  const trade = recipes[recipe];
  if (!trade) {
    throw new Error("unknown_trade");
  }

  if (!canAfford(state.resources, trade.cost)) {
    throw new Error("insufficient_resources");
  }

  pay(state.resources, trade.cost);
  for (const [resource, amount] of Object.entries(trade.reward)) {
    state.resources[resource] += amount;
  }
}

function simulateAttack(state, targetLevel) {
  const level = Number(targetLevel);
  if (![1, 2, 3].includes(level)) {
    throw new Error("invalid_target");
  }

  const armyPower = Object.entries(state.army).reduce((sum, [unitKey, count]) => {
    const unit = GAME_CONFIG.units[unitKey];
    return sum + unit.attack * count;
  }, 0);

  const siegePower = state.army.ram * 30;
  const enemyBase = 120 * level;
  const enemyWall = 10 * level;
  const enemyTower = 20 * level;

  const ownDefenseBonus = 1 + state.buildings.wall * 0.08;
  const effectiveAttack = armyPower + siegePower;
  const effectiveEnemy = (enemyBase + enemyWall + enemyTower) / ownDefenseBonus;

  const won = effectiveAttack > effectiveEnemy;
  const randomLossFactor = won ? 0.15 : 0.35;

  for (const unitKey of Object.keys(state.army)) {
    const current = state.army[unitKey];
    if (current <= 0) {
      continue;
    }
    const loss = Math.floor(current * randomLossFactor * (unitKey === "ram" ? 0.5 : 1));
    state.army[unitKey] = Math.max(0, current - loss);
  }

  let result;
  if (won) {
    state.stats.battlesWon += 1;
    const loot = {
      wood: 120 * level,
      stone: 80 * level,
      gold: 35 * level
    };

    for (const [resource, amount] of Object.entries(loot)) {
      state.resources[resource] += amount;
    }

    result = {
      won,
      summary: `Sieg! Du plünderst ${loot.wood} Holz, ${loot.stone} Stein und ${loot.gold} Gold.`,
      loot
    };
  } else {
    result = {
      won,
      summary: "Niederlage. Deine Armee war zu schwach gegen die Zielverteidigung.",
      loot: null
    };
  }

  evaluateQuests(state);
  return result;
}

function evaluateQuests(state) {
  for (const quest of state.quests) {
    if (quest.done) {
      continue;
    }

    if (quest.id === "build-1" && state.stats.buildingsConstructed >= 1) {
      completeQuest(state, quest);
    }

    if (quest.id === "army-10" && state.stats.unitsTrained >= 10) {
      completeQuest(state, quest);
    }

    if (quest.id === "battle-win" && state.stats.battlesWon >= 1) {
      completeQuest(state, quest);
    }
  }
}

function completeQuest(state, quest) {
  quest.done = true;
  for (const [resource, amount] of Object.entries(quest.reward)) {
    state.resources[resource] += amount;
  }
}

module.exports = {
  GAME_CONFIG,
  createNewState,
  tickState,
  queueBuilding,
  queueUnit,
  performTrade,
  simulateAttack
};
