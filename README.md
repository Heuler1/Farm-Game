# Farm-Game / Kapiland-Style Wirtschaftsspiel (Extended)

Das Spiel wurde auf einen langfristigen Wirtschaftssimulator ausgebaut:

- Rohstoffproduktion
- Weiterverarbeitung über Produktionsketten
- Verkaufsladen für Systemverkäufe
- Handel (Systemmarkt + Spieler-zu-Spieler-Angebote)
- Vertragssystem mit Tier-Freischaltung und Zyklen
- Forschungszweig mit langfristigen Boni

## Bestandteile

- `public/` – Browser-Frontend-Prototyp
- `server/` – API mit Wirtschafts-Engine und persistentem Speicher

## Schnellstart (ohne npm install)

### API starten

```bash
npm run start:api
```

API: `http://localhost:4000`

### Frontend starten

```bash
cd public
npm run start
```

Frontend: typischerweise `http://localhost:3000`

## API-Endpunkte

- `POST /api/auth/anonymous`
- `GET /api/config`
- `GET /api/state`
- `POST /api/actions/build`
- `POST /api/actions/market/buy`
- `POST /api/actions/market/sell`
- `POST /api/actions/system-store/sell`
- `POST /api/actions/contracts/complete`
- `POST /api/actions/research/start`
- `GET /api/player-market/offers`
- `POST /api/actions/player-market/create-offer`
- `POST /api/actions/player-market/accept-offer`

Alle Action-Endpunkte benötigen: `Authorization: Bearer <token>`.
