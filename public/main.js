const STORAGE_KEY = "kapiland-extended-save-v1";
const TICK_MS = 1000;

const CONFIG = {
  resources: ["wood", "grain", "flour", "bread", "iron", "tools", "gold"],
  buildings: {
    lumbercamp: { name: "Holzfällerei", baseCost: { gold: 100, wood: 40 }, baseTimeSec: 12, baseOutputPerHour: { wood: 45 } },
    farm: { name: "Getreidehof", baseCost: { gold: 120, wood: 50 }, baseTimeSec: 14, baseOutputPerHour: { grain: 40 } },
    mine: { name: "Eisenmine", baseCost: { gold: 160, wood: 50, tools: 5 }, baseTimeSec: 18, baseOutputPerHour: { iron: 22 } },
    mill: { name: "Mühle", baseCost: { gold: 180, wood: 80 }, baseTimeSec: 20, recipePerHour: { input: { grain: 28 }, output: { flour: 20 } } },
    bakery: { name: "Bäckerei", baseCost: { gold: 220, wood: 90, tools: 6 }, baseTimeSec: 22, recipePerHour: { input: { flour: 18 }, output: { bread: 18 } } },
    workshop: { name: "Werkstatt", baseCost: { gold: 260, wood: 80, iron: 30 }, baseTimeSec: 26, recipePerHour: { input: { iron: 14, wood: 16 }, output: { tools: 8 } } },
    supermarket: { name: "Verkaufsladen", baseCost: { gold: 300, wood: 120, tools: 20 }, baseTimeSec: 30 }
  },
  marketPrices: {
    wood: { buy: 5, sell: 3 }, grain: { buy: 6, sell: 4 }, flour: { buy: 11, sell: 8 },
    bread: { buy: 16, sell: 11 }, iron: { buy: 14, sell: 10 }, tools: { buy: 26, sell: 20 }
  },
  contracts: [
    { id: "starter-bread", tier: 1, text: "Liefere 60 Brot", needs: { bread: 60 }, reward: { gold: 600 }, done: false },
    { id: "tools-order", tier: 1, text: "Liefere 25 Werkzeuge", needs: { tools: 25 }, reward: { gold: 900, wood: 150 }, done: false },
    { id: "mixed-order", tier: 2, text: "Liefere 80 Holz + 50 Eisen", needs: { wood: 80, iron: 50 }, reward: { gold: 750 }, done: false },
    { id: "city-supply", tier: 3, text: "Liefere 140 Brot + 40 Werkzeuge", needs: { bread: 140, tools: 40 }, reward: { gold: 2200, iron: 120 }, done: false }
  ],
  research: {
    production_efficiency: { name: "Produktionseffizienz", maxLevel: 20, baseCost: { gold: 500, tools: 10 }, baseTimeSec: 35, effect: "+5% Produktion/Lv" },
    logistics: { name: "Logistik", maxLevel: 20, baseCost: { gold: 450, wood: 100, tools: 8 }, baseTimeSec: 30, effect: "-3% Bauzeit/Lv" },
    trade_negotiation: { name: "Handelsverhandlung", maxLevel: 20, baseCost: { gold: 600, bread: 30, tools: 12 }, baseTimeSec: 38, effect: "+2% Verkauf/Lv" },
    contract_management: { name: "Vertragsmanagement", maxLevel: 20, baseCost: { gold: 700, flour: 40, tools: 14 }, baseTimeSec: 42, effect: "+4% Auftragsertrag/Lv" }
  }
};

const defaultState = {
  lastTick: Date.now(),
  resources: { wood: 180, grain: 140, flour: 20, bread: 10, iron: 40, tools: 10, gold: 800 },
  buildings: { lumbercamp: 1, farm: 1, mine: 1, mill: 1, bakery: 0, workshop: 0, supermarket: 0 },
  queue: [],
  contracts: structuredClone(CONFIG.contracts),
  research: {
    levels: Object.fromEntries(Object.keys(CONFIG.research).map((key) => [key, 0])),
    queue: []
  },
  stats: { contractsCompleted: 0, marketVolume: 0, contractCycles: 0 }
};

let state = loadState();

const el = {
  resourceBar: document.getElementById("resource-bar"),
  buildings: document.getElementById("buildings"),
  queue: document.getElementById("queue"),
  market: document.getElementById("market"),
  contracts: document.getElementById("contracts"),
  contractResult: document.getElementById("contract-result"),
  chains: document.getElementById("chains"),
  systemStore: document.getElementById("system-store"),
  researchList: document.getElementById("research-list"),
  researchQueue: document.getElementById("research-queue"),
  progress: document.getElementById("progress")
};

document.getElementById("reset-btn").addEventListener("click", () => {
  if (!confirm("Spielstand wirklich zurücksetzen?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultState);
  render();
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);

  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      resources: { ...defaultState.resources, ...parsed.resources },
      buildings: { ...defaultState.buildings, ...parsed.buildings },
      contracts: (parsed.contracts || structuredClone(CONFIG.contracts)).map((entry) => ({ ...entry })),
      research: {
        levels: { ...defaultState.research.levels, ...(parsed.research?.levels || {}) },
        queue: parsed.research?.queue || []
      },
      stats: { ...defaultState.stats, ...(parsed.stats || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  state.lastTick = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function productionMultiplier() {
  return 1 + state.research.levels.production_efficiency * 0.05;
}

function logisticsMultiplier() {
  return Math.max(0.35, 1 - state.research.levels.logistics * 0.03);
}

function sellMultiplier() {
  return 1 + state.research.levels.trade_negotiation * 0.02;
}

function contractMultiplier() {
  return 1 + state.research.levels.contract_management * 0.04;
}

function tick() {
  const now = Date.now();
  const deltaSec = Math.max(1, Math.floor((now - state.lastTick) / 1000));
  state.lastTick = now;

  produceRawResources(deltaSec);
  runRecipes(deltaSec);
  resolveBuildingQueue(now);
  resolveResearchQueue(now);

  saveState();
  render();
}

function produceRawResources(deltaSec) {
  const prod = productionMultiplier();
  for (const [buildingKey, level] of Object.entries(state.buildings)) {
    const definition = CONFIG.buildings[buildingKey];
    if (!definition?.baseOutputPerHour || level <= 0) continue;

    for (const [resource, amountPerHour] of Object.entries(definition.baseOutputPerHour)) {
      state.resources[resource] += ((amountPerHour * level * deltaSec) / 3600) * prod;
    }
  }
}

function runRecipes(deltaSec) {
  const prod = productionMultiplier();
  for (const [buildingKey, level] of Object.entries(state.buildings)) {
    const definition = CONFIG.buildings[buildingKey];
    if (!definition?.recipePerHour || level <= 0) continue;

    const cycles = (deltaSec / 3600) * level * prod;
    const needs = scaleMap(definition.recipePerHour.input, cycles);
    const ratio = affordableRatio(needs);
    if (ratio <= 0) continue;

    subtractResources(scaleMap(needs, ratio));
    addResources(scaleMap(scaleMap(definition.recipePerHour.output, cycles), ratio));
  }
}

function resolveBuildingQueue(now) {
  const ready = state.queue.filter((item) => item.completeAt <= now);
  state.queue = state.queue.filter((item) => item.completeAt > now);
  for (const item of ready) {
    state.buildings[item.key] += 1;
  }
}

function resolveResearchQueue(now) {
  const ready = state.research.queue.filter((item) => item.completeAt <= now);
  state.research.queue = state.research.queue.filter((item) => item.completeAt > now);
  for (const item of ready) {
    state.research.levels[item.key] += 1;
  }
}

function scaleMap(map, factor) {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v * factor]));
}

function affordableRatio(neededMap) {
  let ratio = 1;
  for (const [resource, needed] of Object.entries(neededMap)) {
    if (needed <= 0) continue;
    ratio = Math.min(ratio, (state.resources[resource] || 0) / needed);
  }
  return Math.max(0, Math.min(1, ratio));
}

function subtractResources(costs) {
  for (const [resource, amount] of Object.entries(costs)) {
    state.resources[resource] -= amount;
  }
}

function addResources(gains) {
  for (const [resource, amount] of Object.entries(gains)) {
    state.resources[resource] += amount;
  }
}

function scaledCost(baseCost, level) {
  const factor = Math.pow(1.35, level);
  return Object.fromEntries(Object.entries(baseCost).map(([resource, amount]) => [resource, Math.ceil(amount * factor)]));
}

function canAfford(cost) {
  return Object.entries(cost).every(([resource, amount]) => (state.resources[resource] || 0) >= amount);
}

function companyTier() {
  return 1 + Math.floor(state.stats.contractsCompleted / 4);
}

function queueBuilding(key) {
  const definition = CONFIG.buildings[key];
  const level = state.buildings[key];
  const cost = scaledCost(definition.baseCost, level);

  if (!canAfford(cost)) return alert("Nicht genug Ressourcen.");
  subtractResources(cost);

  const seconds = Math.ceil(definition.baseTimeSec * logisticsMultiplier());
  state.queue.push({ type: "building", key, completeAt: Date.now() + seconds * 1000 });
  saveState();
  render();
}

function marketBuy(resource, amount = 10) {
  const total = CONFIG.marketPrices[resource].buy * amount;
  if (state.resources.gold < total) return alert("Zu wenig Gold.");
  state.resources.gold -= total;
  state.resources[resource] += amount;
  state.stats.marketVolume += amount;
  saveState();
  render();
}

function marketSell(resource, amount = 10) {
  if ((state.resources[resource] || 0) < amount) return alert("Zu wenig Bestand.");
  const payout = Math.floor(CONFIG.marketPrices[resource].sell * amount * sellMultiplier());
  state.resources[resource] -= amount;
  state.resources.gold += payout;
  state.stats.marketVolume += amount;
  saveState();
  render();
}

function sellToSystemStore(resource, amount = 20) {
  if (state.buildings.supermarket <= 0) return alert("Baue zuerst einen Verkaufsladen.");
  marketSell(resource, amount);
}

function completeContract(contractId) {
  const contract = state.contracts.find((entry) => entry.id === contractId);
  if (!contract || contract.done) return;
  if (contract.tier > companyTier()) return alert("Vertrag noch gesperrt (höhere Firmenstufe nötig).");
  if (!canAfford(contract.needs)) return alert("Nicht genug Waren für diesen Auftrag.");

  subtractResources(contract.needs);
  addResources(scaleMap(contract.reward, contractMultiplier()));
  contract.done = true;
  state.stats.contractsCompleted += 1;
  el.contractResult.textContent = `Auftrag erledigt: ${contract.text}`;

  const active = state.contracts.filter((entry) => entry.tier <= companyTier());
  if (active.length > 0 && active.every((entry) => entry.done)) {
    for (const entry of active) entry.done = false;
    state.stats.contractCycles += 1;
  }

  saveState();
  render();
}

function startResearch(researchKey) {
  const definition = CONFIG.research[researchKey];
  const level = state.research.levels[researchKey];
  if (level >= definition.maxLevel) return alert("Diese Forschung ist bereits am Maximum.");
  if (state.research.queue.length >= 1) return alert("Es läuft bereits eine Forschung.");

  const cost = scaledCost(definition.baseCost, level);
  if (!canAfford(cost)) return alert("Nicht genug Ressourcen für diese Forschung.");

  subtractResources(cost);
  const durationSec = Math.ceil(definition.baseTimeSec * Math.pow(1.15, level));
  state.research.queue.push({ key: researchKey, completeAt: Date.now() + durationSec * 1000 });
  saveState();
  render();
}

function render() {
  el.resourceBar.innerHTML = CONFIG.resources
    .map((resource) => `<div class="resource-pill"><strong>${resource.toUpperCase()}</strong><span>${Math.floor(state.resources[resource])}</span></div>`)
    .join("");

  el.buildings.innerHTML = Object.entries(CONFIG.buildings)
    .map(([key, definition]) => {
      const level = state.buildings[key];
      const cost = scaledCost(definition.baseCost, level);
      const costLabel = Object.entries(cost).map(([r, a]) => `${a} ${r}`).join(", ");
      const effectLabel = definition.baseOutputPerHour
        ? `Produktion: ${Object.entries(definition.baseOutputPerHour).map(([r, a]) => `+${a}/h ${r}`).join(", ")}`
        : definition.recipePerHour
          ? `Rezept: ${Object.entries(definition.recipePerHour.input).map(([r, a]) => `${a}/h ${r}`).join(" + ")} → ${Object.entries(definition.recipePerHour.output).map(([r, a]) => `${a}/h ${r}`).join(" + ")}`
          : "Schaltet Systemverkauf frei.";
      return `<article class="card"><h3>${definition.name} <span class="lvl">Lv ${level}</span></h3><p class="meta">${effectLabel}</p><p class="meta">Kosten: ${costLabel}</p><button data-build="${key}">Ausbauen (${Math.ceil(definition.baseTimeSec * logisticsMultiplier())}s)</button></article>`;
    })
    .join("");

  el.buildings.querySelectorAll("[data-build]").forEach((button) => {
    button.addEventListener("click", () => queueBuilding(button.dataset.build));
  });

  el.queue.innerHTML = state.queue.length
    ? state.queue.map((entry) => `<li>${CONFIG.buildings[entry.key].name} fertig in ${Math.max(0, Math.ceil((entry.completeAt - Date.now()) / 1000))}s</li>`).join("")
    : "<li>Keine aktiven Bauaufträge.</li>";

  el.chains.innerHTML = Object.entries(CONFIG.buildings)
    .filter(([, definition]) => Boolean(definition.recipePerHour))
    .map(([key, definition]) => `<li>${definition.name} (Lv ${state.buildings[key]}): ${Object.entries(definition.recipePerHour.input).map(([r, a]) => `${a}/h ${r}`).join(" + ")} → ${Object.entries(definition.recipePerHour.output).map(([r, a]) => `${a}/h ${r}`).join(" + ")}</li>`)
    .join("");

  el.market.innerHTML = Object.entries(CONFIG.marketPrices)
    .map(([resource, price]) => `<article class="card market-row"><h3>${resource.toUpperCase()}</h3><p class="meta">Kauf: ${price.buy} Gold | Verkauf: ${Math.floor(price.sell * sellMultiplier())} Gold</p><div class="market-actions"><button data-buy="${resource}">+10 kaufen</button><button data-sell="${resource}">-10 verkaufen</button></div></article>`)
    .join("");
  el.market.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => marketBuy(button.dataset.buy, 10)));
  el.market.querySelectorAll("[data-sell]").forEach((button) => button.addEventListener("click", () => marketSell(button.dataset.sell, 10)));

  el.systemStore.innerHTML = ["bread", "flour", "tools"].map((resource) => `<button data-system-sell="${resource}">${resource.toUpperCase()} x20 an System verkaufen</button>`).join(" ");
  el.systemStore.querySelectorAll("[data-system-sell]").forEach((button) => button.addEventListener("click", () => sellToSystemStore(button.dataset.systemSell, 20)));

  el.contracts.innerHTML = state.contracts
    .map((contract) => {
      const needs = Object.entries(contract.needs).map(([r, a]) => `${a} ${r}`).join(", ");
      const rewards = Object.entries(scaleMap(contract.reward, contractMultiplier())).map(([r, a]) => `${Math.floor(a)} ${r}`).join(", ");
      const locked = contract.tier > companyTier();
      const button = contract.done || locked ? "" : `<button data-contract="${contract.id}">Erfüllen</button>`;
      return `<li>${contract.done ? "✅" : locked ? "🔒" : "⬜"} ${contract.text} (Tier ${contract.tier}) <small>Benötigt: ${needs} | Belohnung: ${rewards}</small> ${button}</li>`;
    })
    .join("");
  el.contracts.querySelectorAll("[data-contract]").forEach((button) => button.addEventListener("click", () => completeContract(button.dataset.contract)));

  el.researchList.innerHTML = Object.entries(CONFIG.research)
    .map(([key, definition]) => {
      const level = state.research.levels[key];
      const cost = scaledCost(definition.baseCost, level);
      const costLabel = Object.entries(cost).map(([r, a]) => `${a} ${r}`).join(", ");
      return `<li><strong>${definition.name}</strong> Lv ${level}/${definition.maxLevel} – ${definition.effect}<br/><small>Kosten: ${costLabel}</small> ${level >= definition.maxLevel ? "" : `<button data-research="${key}">Starten</button>`}</li>`;
    })
    .join("");
  el.researchList.querySelectorAll("[data-research]").forEach((button) => button.addEventListener("click", () => startResearch(button.dataset.research)));

  el.researchQueue.innerHTML = state.research.queue.length
    ? state.research.queue.map((entry) => `<li>${CONFIG.research[entry.key].name} fertig in ${Math.max(0, Math.ceil((entry.completeAt - Date.now()) / 1000))}s</li>`).join("")
    : "<li>Keine aktive Forschung.</li>";

  el.progress.innerHTML = `
    <li>Firmenstufe (aus Aufträgen): <strong>${companyTier()}</strong></li>
    <li>Abgeschlossene Aufträge: <strong>${state.stats.contractsCompleted}</strong></li>
    <li>Vollständige Vertragszyklen: <strong>${state.stats.contractCycles}</strong></li>
    <li>Marktvolumen: <strong>${Math.floor(state.stats.marketVolume)}</strong></li>
  `;
}

render();
setInterval(tick, TICK_MS);
