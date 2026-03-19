# Wifi Planner by Marcone

**[Italiano](#italiano) | [English](#english)**

---

## Italiano

Strumento web di pianificazione WiFi per il posizionamento di access point su planimetrie. Simula la propagazione del segnale WiFi utilizzando modelli di perdita di percorso indoor con specifiche reali degli access point Extreme Networks AP3000.

### Funzionalità

- **Importazione planimetrie** — Carica PDF, DXF/DWG o immagini delle planimetrie
- **Calibrazione scala** — Obbligatoria all'apertura, misura due punti di distanza nota
- **Disegno muri** — Catena continua, materiali diversi (cemento, cartongesso, vetro, legno), colori e attenuazione differenziati
- **Posizionamento AP** — Icone blu draggabili con nome, doppio click per eliminare
- **Simulazione segnale WiFi** — Modello log-distance con specifiche reali AP3000:
  - TX Power: 18 dBm, Antenna 2.4 GHz: 4.2 dBi, 5 GHz: 5.07 dBi
  - Altezza soffitto: 3.5m, clutter ambientale: 0.3 dB/m
  - Attenuazione muri tramite ray-casting
- **Modalità Copertura** — Visualizza il segnale migliore per ogni punto (verde forte, giallo medio, marrone debole)
- **Modalità Overlap** — Evidenzia zone di sovrapposizione tra AP (blu=1 AP, verde=roaming, rosso=interferenza)
- **Tooltip dBm** — Valore del segnale in tempo reale al passaggio del mouse
- **Righello** — Misura distanze sulla planimetria in metri/cm
- **Scala in metri** — Barra visuale in basso a destra
- **Esportazione PDF** — Salva la planimetria con AP, muri e heatmap
- **Riconoscimento muri AI** — Rileva automaticamente i muri dalle planimetrie (DeepFloorPlan)

### Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Backend | FastAPI + SQLAlchemy Async + PostgreSQL |
| Frontend | React + Vite + Konva.js + Zustand |
| PDF Export | jsPDF |
| Infrastruttura | Docker Compose (6 container) |
| AI | TF2DeepFloorPlan per riconoscimento muri |
| Storage | MinIO (S3-compatibile) |

### Installazione

```bash
# Clona il repository
git clone https://github.com/mmereu/wifi-planner.git
cd wifi-planner

# Configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali

# Avvia con Docker Compose
docker compose up -d --build

# Accedi all'applicazione
open http://localhost
```

### Screenshot

*In arrivo*

### Specifiche AP Supportati

| Parametro | 2.4 GHz | 5 GHz |
|---|---|---|
| TX Power | 18 dBm | 18 dBm |
| Guadagno Antenna | 4.2 dBi | 5.07 dBi |
| EIRP | 22.2 dBm | 23.07 dBm |
| Sensibilità (MCS basso) | -94 dBm | -94 dBm |

### Autore

**Marco Mereu** — Network Engineer

---

## English

Web-based WiFi planning tool for positioning access points on floor plans. Simulates WiFi signal propagation using indoor path loss models with real Extreme Networks AP3000 access point specifications.

### Features

- **Floor plan import** — Upload PDF, DXF/DWG or image floor plans
- **Scale calibration** — Mandatory on first open, measure two points of known distance
- **Wall drawing** — Continuous chain mode, different materials (concrete, drywall, glass, wood) with differentiated colors and attenuation
- **AP placement** — Draggable blue icons with name label, double-click to delete
- **WiFi signal simulation** — Log-distance model with real AP3000 specs:
  - TX Power: 18 dBm, Antenna 2.4 GHz: 4.2 dBi, 5 GHz: 5.07 dBi
  - Ceiling height: 3.5m, environmental clutter: 0.3 dB/m
  - Wall attenuation via ray-casting
- **Coverage mode** — Shows best signal per point (green strong, yellow medium, brown weak)
- **Overlap mode** — Highlights AP overlap zones (blue=1 AP, green=roaming, red=interference)
- **dBm tooltip** — Real-time signal value on mouse hover
- **Ruler tool** — Measure distances on the floor plan in meters/cm
- **Meter scale** — Visual bar in bottom-right corner
- **PDF export** — Save floor plan with APs, walls and heatmap
- **AI wall detection** — Automatically detect walls from floor plans (DeepFloorPlan)

### Tech Stack

| Component | Technology |
|---|---|
| Backend | FastAPI + SQLAlchemy Async + PostgreSQL |
| Frontend | React + Vite + Konva.js + Zustand |
| PDF Export | jsPDF |
| Infrastructure | Docker Compose (6 containers) |
| AI | TF2DeepFloorPlan for wall detection |
| Storage | MinIO (S3-compatible) |

### Installation

```bash
# Clone the repository
git clone https://github.com/mmereu/wifi-planner.git
cd wifi-planner

# Configure environment variables
cp .env.example .env
# Edit .env with your credentials

# Start with Docker Compose
docker compose up -d --build

# Access the application
open http://localhost
```

### Supported AP Specifications

| Parameter | 2.4 GHz | 5 GHz |
|---|---|---|
| TX Power | 18 dBm | 18 dBm |
| Antenna Gain | 4.2 dBi | 5.07 dBi |
| EIRP | 22.2 dBm | 23.07 dBm |
| Sensitivity (low MCS) | -94 dBm | -94 dBm |

### Author

**Marco Mereu** — Network Engineer

---

## License

MIT License
