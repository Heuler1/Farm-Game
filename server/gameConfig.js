const GAME_CONFIG = {
  resources: ["wood", "grain", "flour", "bread", "iron", "tools", "gold"],
  buildings: {
    lumbercamp: {
      name: "Holzfällerei",
      baseCost: { gold: 100, wood: 40 },
      baseTimeSec: 12,
      baseOutputPerHour: { wood: 45 }
    },
    farm: {
      name: "Getreidehof",
      baseCost: { gold: 120, wood: 50 },
      baseTimeSec: 14,
      baseOutputPerHour: { grain: 40 }
    },
    mine: {
      name: "Eisenmine",
      baseCost: { gold: 160, wood: 50, tools: 5 },
      baseTimeSec: 18,
      baseOutputPerHour: { iron: 22 }
    },
    mill: {
      name: "Mühle",
      baseCost: { gold: 180, wood: 80 },
      baseTimeSec: 20,
      recipePerHour: { input: { grain: 28 }, output: { flour: 20 } }
    },
    bakery: {
      name: "Bäckerei",
      baseCost: { gold: 220, wood: 90, tools: 6 },
      baseTimeSec: 22,
      recipePerHour: { input: { flour: 18 }, output: { bread: 18 } }
    },
    workshop: {
      name: "Werkstatt",
      baseCost: { gold: 260, wood: 80, iron: 30 },
      baseTimeSec: 26,
      recipePerHour: { input: { iron: 14, wood: 16 }, output: { tools: 8 } }
    },
    supermarket: {
      name: "Verkaufsladen",
      baseCost: { gold: 300, wood: 120, tools: 20 },
      baseTimeSec: 30
    }
  },
  marketPrices: {
    wood: { buy: 5, sell: 3 },
    grain: { buy: 6, sell: 4 },
    flour: { buy: 11, sell: 8 },
    bread: { buy: 16, sell: 11 },
    iron: { buy: 14, sell: 10 },
    tools: { buy: 26, sell: 20 }
  },
  contracts: [
    { id: "starter-bread", tier: 1, text: "Liefere 60 Brot", needs: { bread: 60 }, reward: { gold: 600 } },
    { id: "tools-order", tier: 1, text: "Liefere 25 Werkzeuge", needs: { tools: 25 }, reward: { gold: 900, wood: 150 } },
    { id: "mixed-order", tier: 2, text: "Liefere 80 Holz + 50 Eisen", needs: { wood: 80, iron: 50 }, reward: { gold: 750 } },
    { id: "city-supply", tier: 3, text: "Liefere 140 Brot + 40 Werkzeuge", needs: { bread: 140, tools: 40 }, reward: { gold: 2200, iron: 120 } }
  ],
  research: {
    production_efficiency: {
      name: "Produktionseffizienz",
      maxLevel: 20,
      baseCost: { gold: 500, tools: 10 },
      baseTimeSec: 35,
      effect: "+5% Produktion pro Stufe"
    },
    logistics: {
      name: "Logistik",
      maxLevel: 20,
      baseCost: { gold: 450, wood: 100, tools: 8 },
      baseTimeSec: 30,
      effect: "-3% Bauzeit pro Stufe"
    },
    trade_negotiation: {
      name: "Handelsverhandlung",
      maxLevel: 20,
      baseCost: { gold: 600, bread: 30, tools: 12 },
      baseTimeSec: 38,
      effect: "+2% Verkaufspreis pro Stufe"
    },
    contract_management: {
      name: "Vertragsmanagement",
      maxLevel: 20,
      baseCost: { gold: 700, flour: 40, tools: 14 },
      baseTimeSec: 42,
      effect: "+4% Vertragsbelohnung pro Stufe"
    }
  }
};

module.exports = { GAME_CONFIG };
