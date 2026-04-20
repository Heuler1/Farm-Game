const GAME_CONFIG = {
  resources: ["wood", "stone", "food", "iron", "gold"],
  buildings: {
    lumberyard: {
      name: "Holzfällerlager",
      baseCost: { wood: 60, stone: 30 },
      baseTimeSec: 12,
      productionBoost: { wood: 20 }
    },
    quarry: {
      name: "Steinbruch",
      baseCost: { wood: 80, stone: 20 },
      baseTimeSec: 14,
      productionBoost: { stone: 16 }
    },
    farm: {
      name: "Farm",
      baseCost: { wood: 50, stone: 40 },
      baseTimeSec: 10,
      productionBoost: { food: 18 }
    },
    ironMine: {
      name: "Eisenmine",
      baseCost: { wood: 100, stone: 80 },
      baseTimeSec: 18,
      productionBoost: { iron: 10 }
    },
    wall: {
      name: "Stadtmauer",
      baseCost: { wood: 120, stone: 140 },
      baseTimeSec: 20
    },
    tower: {
      name: "Wachturm",
      baseCost: { wood: 100, stone: 120, iron: 50 },
      baseTimeSec: 22
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
    { id: "build-1", text: "Baue 1 Gebäude", reward: { gold: 100 } },
    { id: "army-10", text: "Rekrutiere 10 Einheiten", reward: { wood: 200, iron: 80 } },
    { id: "battle-win", text: "Gewinne 1 Angriff", reward: { gold: 250 } }
  ]
};

module.exports = { GAME_CONFIG };
