# Farm-Game / Kingdoms of Iron

Schritt 2 umgesetzt: Das Projekt enthält jetzt neben dem Frontend-Prototyp ein **echtes Backend-Fundament** mit persistenter Spiel-Session und serverseitiger Spiel-Logik.

## Bestandteile

- `public/` – Browser-Frontend-Prototyp
- `server/` – Express-API mit Spielengine und Dateispeicher

## API starten

```bash
npm install
npm run start:api
```

API-URL: `http://localhost:4000`

## Frontend starten

```bash
cd public
npm install
npm run start
```

Frontend-URL: typischerweise `http://localhost:3000`

## Wichtige API-Endpunkte

- `POST /api/auth/anonymous` – erzeugt Token/Session
- `GET /api/config` – liefert Spielkonfiguration
- `GET /api/state` – aktueller serverseitiger Zustand (mit Tick)
- `POST /api/actions/build` – Gebäude in Queue (`{ buildingKey }`)
- `POST /api/actions/train` – Einheit trainieren (`{ unitKey }`)
- `POST /api/actions/trade` – Markt-Trade (`{ recipe }`)
- `POST /api/actions/attack` – Angriff simulieren (`{ targetLevel }`)

Alle Action-Endpunkte erwarten `Authorization: Bearer <token>`.
