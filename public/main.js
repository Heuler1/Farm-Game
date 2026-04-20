const STORAGE_KEY = "kingdoms-of-iron-save-v1";
const TICK_MS = 1000;

const GAME_CONFIG = {
  resources: ["wood", "stone", "food", "iron", "gold"],
  buildings: {
    lumberyard: {
      name: "Holzfällerlager",
      baseCost: { wood: 60, stone: 30 },
      baseTimeSec: 12,
      effect: "+20 Holz/Stunde"
    },
    quarry: {
      name: "Steinbruch",
      baseCost: { wood: 80, stone: 20 },
      baseTimeSec: 14,
      effect: "+16 Stein/Stunde"
    },
    farm: {
      name: "Farm",
      baseCost: { wood: 50, stone: 40 },
      baseTimeSec: 10,
      effect: "+18 Nahrung/Stunde"
    },
    ironMine: {
      name: "Eisenmine",
      baseCost: { wood: 100, stone: 80 },
      baseTimeSec: 18,
      effect: "+10 Eisen/Stunde"
    },
    wall: {
      name: "Stadtmauer",
      baseCost: { wood: 120, stone: 140 },
      baseTimeSec: 20,
      effect: "+8% Verteidigung pro Stufe"
    },
    tower: {
      name: "Wachturm",
      baseCost: { wood: 100, stone: 120, iron: 50 },
      baseTimeSec: 22,
      effect: "+15 fester Defensivwert pro Stufe"
    }
  },
  units: {
    spearman: {
      name: "Speerträger",
      cost: { food: 30, wood: 20, iron: 10 },
      trainSec: 9,
      attack: 15,
      defense: 12
    },
    swordsman: {
      name: "Schwertkämpfer",
      cost: { food: 45, wood: 20, iron: 20 },
      trainSec: 12,
      attack: 23,
      defense: 20
    },
    archer: {
      name: "Bogenschütze",
      cost: { food: 25, wood: 35, iron: 10 },
      trainSec: 10,
      attack: 20,
      defense: 10
    },
    ram: {
      name: "Rammbock",
      cost: { food: 50, wood: 70, iron: 40 },
      trainSec: 18,
      attack: 40,
      defense: 8,
      siege: 1
    }
  },
  quests: [
    { id: "build-1", text: "Baue 1 Gebäude", reward: { gold: 100 }, done: false },
    { id: "army-10", text: "Rekrutiere 10 Einheiten", reward: { wood: 200, iron: 80 }, done: false },
    { id: "battle-win", text: "Gewinne 1 Angriff", reward: { gold: 250 }, done: false }
  ]
};

const defaultState = {
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
  quests: structuredClone(GAME_CONFIG.quests)
};

let state = loadState();

const resourceBar = document.getElementById("resource-bar");
const buildingsEl = document.getElementById("buildings");
const unitsEl = document.getElementById("units");
const armyListEl = document.getElementById("army-list");
const queueEl = document.getElementById("queue");
const questsEl = document.getElementById("quests");
const battleResultEl = document.getElementById("battle-result");
const targetLevelEl = document.getElementById("target-level");

document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Wirklich alles löschen und neu starten?")) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state = loadState(true);
  render();
});

document.querySelectorAll("[data-trade]").forEach((button) => {
  button.addEventListener("click", () => performTrade(button.dataset.trade));
});

document.getElementById("attack-btn").addEventListener("click", simulateAttack);

function loadState(forceDefault = false) {
  if (forceDefault) {
    return structuredClone(defaultState);
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      resources: { ...defaultState.resources, ...parsed.resources },
      productionPerHour: { ...defaultState.productionPerHour, ...parsed.productionPerHour },
      buildings: { ...defaultState.buildings, ...parsed.buildings },
      army: { ...defaultState.army, ...parsed.army },
      stats: { ...defaultState.stats, ...parsed.stats },
      quests: (parsed.quests || structuredClone(GAME_CONFIG.quests)).map((quest) => ({
        ...quest
      }))
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.lastTick = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function tick() {
  const now = Date.now();
  const deltaSec = Math.max(1, Math.floor((now - state.lastTick) / 1000));
  state.lastTick = now;

  for (const resource of GAME_CONFIG.resources) {
    const perSec = (state.productionPerHour[resource] || 0) / 3600;
    state.resources[resource] += perSec * deltaSec;
  }

  processQueue(now);
  evaluateQuests();
  saveState();
  render();
}

function processQueue(now) {
  const ready = state.queue.filter((item) => item.completeAt <= now);
  if (!ready.length) {
    return;
  }

  state.queue = state.queue.filter((item) => item.completeAt > now);

  for (const item of ready) {
    if (item.type === "building") {
      state.buildings[item.key] += 1;
      state.stats.buildingsConstructed += 1;
      applyBuildingEffects(item.key);
    }

    if (item.type === "unit") {
      state.army[item.key] += 1;
      state.stats.unitsTrained += 1;
    }
  }
}

function applyBuildingEffects(buildingKey) {
  if (buildingKey === "lumberyard") state.productionPerHour.wood += 20;
  if (buildingKey === "quarry") state.productionPerHour.stone += 16;
  if (buildingKey === "farm") state.productionPerHour.food += 18;
  if (buildingKey === "ironMine") state.productionPerHour.iron += 10;
}

function evaluateQuests() {
  for (const quest of state.quests) {
    if (quest.done) {
      continue;
    }

    if (quest.id === "build-1" && state.stats.buildingsConstructed >= 1) {
      completeQuest(quest);
    }

    if (quest.id === "army-10" && state.stats.unitsTrained >= 10) {
      completeQuest(quest);
    }

    if (quest.id === "battle-win" && state.stats.battlesWon >= 1) {
      completeQuest(quest);
    }
  }
}

function completeQuest(quest) {
  quest.done = true;
  for (const [resource, amount] of Object.entries(quest.reward)) {
    state.resources[resource] += amount;
  }
}

function scaledCost(baseCost, level) {
  const factor = Math.pow(1.35, level);
  return Object.fromEntries(
    Object.entries(baseCost).map(([resource, amount]) => [resource, Math.ceil(amount * factor)])
  );
}

function canAfford(cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function pay(cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    state.resources[resource] -= amount;
  }
}

function queueBuilding(key) {
  const level = state.buildings[key];
  const definition = GAME_CONFIG.buildings[key];
  const cost = scaledCost(definition.baseCost, level);
  if (!canAfford(cost)) {
    alert("Nicht genug Ressourcen für dieses Gebäude.");
    return;
  }

  pay(cost);
  const completeAt = Date.now() + definition.baseTimeSec * 1000;
  state.queue.push({ type: "building", key, completeAt });
  saveState();
  render();
}

function queueUnit(key) {
  const definition = GAME_CONFIG.units[key];
  if (!canAfford(definition.cost)) {
    alert("Nicht genug Ressourcen für diese Einheit.");
    return;
  }

  pay(definition.cost);
  const completeAt = Date.now() + definition.trainSec * 1000;
  state.queue.push({ type: "unit", key, completeAt });
  saveState();
  render();
}

function performTrade(mode) {
  const recipes = {
    "wood-stone": { cost: { wood: 100 }, reward: { stone: 70 } },
    "wood-iron": { cost: { wood: 100 }, reward: { iron: 60 } }
  };

  const trade = recipes[mode];
  if (!trade) {
    return;
  }

  if (!canAfford(trade.cost)) {
    alert("Nicht genug Holz für diesen Handel.");
    return;
  }

  pay(trade.cost);
  for (const [resource, amount] of Object.entries(trade.reward)) {
    state.resources[resource] += amount;
  }

  saveState();
  render();
}

function simulateAttack() {
  const targetLevel = Number(targetLevelEl.value);
  const armyPower = Object.entries(state.army).reduce((sum, [unitKey, count]) => {
    const unit = GAME_CONFIG.units[unitKey];
    return sum + unit.attack * count;
  }, 0);

  const siegePower = state.army.ram * 30;

  const enemyBase = 120 * targetLevel;
  const enemyWall = 10 * targetLevel;
  const enemyTower = 20 * targetLevel;

  const ownDefenseBonus = 1 + state.buildings.wall * 0.08;
  const effectiveAttack = armyPower + siegePower;
  const effectiveEnemy = (enemyBase + enemyWall + enemyTower) / ownDefenseBonus;

  const won = effectiveAttack > effectiveEnemy;
  const randomLossFactor = won ? 0.15 : 0.35;

  for (const unitKey of Object.keys(state.army)) {
    const current = state.army[unitKey];
    if (current <= 0) continue;
    const loss = Math.floor(current * randomLossFactor * (unitKey === "ram" ? 0.5 : 1));
    state.army[unitKey] = Math.max(0, current - loss);
  }

  let summary;
  if (won) {
    state.stats.battlesWon += 1;
    const loot = {
      wood: 120 * targetLevel,
      stone: 80 * targetLevel,
      gold: 35 * targetLevel
    };
    for (const [resource, amount] of Object.entries(loot)) {
      state.resources[resource] += amount;
    }

    summary = `Sieg! Du plünderst ${loot.wood} Holz, ${loot.stone} Stein und ${loot.gold} Gold.`;
  } else {
    summary = "Niederlage. Deine Armee war zu schwach gegen die Zielverteidigung.";
  }

  evaluateQuests();
  saveState();
  render();
  battleResultEl.textContent = summary;
}

function render() {
  resourceBar.innerHTML = GAME_CONFIG.resources
    .map((resource) => {
      const value = Math.floor(state.resources[resource]);
      const rate = state.productionPerHour[resource] || 0;
      return `<div class="resource-pill"><strong>${resource.toUpperCase()}</strong><span>${value}</span><small>+${rate}/h</small></div>`;
    })
    .join("");

  buildingsEl.innerHTML = Object.entries(GAME_CONFIG.buildings)
    .map(([key, definition]) => {
      const level = state.buildings[key];
      const cost = scaledCost(definition.baseCost, level);
      const costLabel = Object.entries(cost)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ");
      return `
        <article class="card">
          <h3>${definition.name} <span class="lvl">Lv ${level}</span></h3>
          <p>${definition.effect}</p>
          <p class="meta">Kosten: ${costLabel}</p>
          <button data-build="${key}">Bauen (${definition.baseTimeSec}s)</button>
        </article>
      `;
    })
    .join("");

  buildingsEl.querySelectorAll("[data-build]").forEach((button) => {
    button.addEventListener("click", () => queueBuilding(button.dataset.build));
  });

  unitsEl.innerHTML = Object.entries(GAME_CONFIG.units)
    .map(([key, definition]) => {
      const costLabel = Object.entries(definition.cost)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ");
      return `
        <article class="card">
          <h3>${definition.name}</h3>
          <p class="meta">ATK ${definition.attack} / DEF ${definition.defense}</p>
          <p class="meta">Kosten: ${costLabel}</p>
          <button data-unit="${key}">Rekrutieren (${definition.trainSec}s)</button>
        </article>
      `;
    })
    .join("");

  unitsEl.querySelectorAll("[data-unit]").forEach((button) => {
    button.addEventListener("click", () => queueUnit(button.dataset.unit));
  });

  armyListEl.innerHTML = Object.entries(state.army)
    .map(([key, amount]) => `<li>${GAME_CONFIG.units[key].name}: <strong>${amount}</strong></li>`)
    .join("");

  const now = Date.now();
  queueEl.innerHTML = state.queue.length
    ? state.queue
        .map((entry) => {
          const remaining = Math.max(0, Math.ceil((entry.completeAt - now) / 1000));
          const name = entry.type === "building" ? GAME_CONFIG.buildings[entry.key].name : GAME_CONFIG.units[entry.key].name;
          return `<li>${entry.type === "building" ? "Bau" : "Rekrutierung"}: ${name} – fertig in ${remaining}s</li>`;
        })
        .join("")
    : "<li>Keine aktiven Aufträge.</li>";

  questsEl.innerHTML = state.quests
    .map((quest) => {
      const rewardLabel = Object.entries(quest.reward)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ");
      return `<li>${quest.done ? "✅" : "⬜"} ${quest.text} <small>(Belohnung: ${rewardLabel})</small></li>`;
    })
    .join("");
}

render();
setInterval(tick, TICK_MS);
