# Wifi Planner by Marcone

**[Italiano](#italiano) | [English](#english)**

![AP Placement](docs/screenshots/ap-placement.png)
![Heatmap Coverage](docs/screenshots/heatmap-coverage.png)

---

## Italiano

Strumento web di pianificazione WiFi per il posizionamento di access point su planimetrie. Simula la propagazione del segnale WiFi utilizzando modelli di perdita di percorso indoor con specifiche reali degli access point Extreme Networks AP3000.

### Funzionalità

- **Importazione planimetrie** — Carica PDF, DXF/DWG o immagini
- **Rotazione planimetria** — Ruota la vista di 90° (↺↻) per adattare planimetrie in orientamento non standard
- **Calibrazione scala obbligatoria** — All'apertura di ogni nuovo piano
- **Disegno muri** — Catena continua, materiali diversi (cemento, cartongesso, vetro, vetro Low-E, mattone, metallo, porte, finestre)
- **Scaffalature supermercato** — Tool dedicato (🛒) per disegnare scaffali come segmenti orientabili; 3 tipi con attenuazione RF realistica: Vuoto (5/8 dB), Pieno (12/20 dB), Freschi/refrigerato (16/28 dB a 2.4/5 GHz)
- **Posizionamento AP** — Icone blu draggabili con nome, doppio click per eliminare
- **Heatmap WiFi** — Due modalità: Copertura segnale + Overlap AP (interferenza); include l'attenuazione delle scaffalature nel calcolo
- **Tooltip dBm** — Valore segnale in tempo reale al passaggio del mouse
- **Righello** — Misura distanze sulla planimetria
- **Esportazione PDF** — Planimetria completa con AP, muri e heatmap
- **Riconoscimento muri AI** — DeepFloorPlan

### Requisiti di Sistema

- **Docker** >= 20.10 e **Docker Compose** >= 2.0
- **RAM**: minimo 4 GB (consigliati 8 GB per il modulo AI)
- **Disco**: minimo 5 GB liberi
- **Porte**: 80 (HTTP), 443 (HTTPS opzionale)
- **OS**: Linux (produzione), Windows/macOS (sviluppo)

### Installazione Passo-Passo

#### 1. Clona il repository

```bash
git clone https://github.com/mmereu/wifi-planner.git
cd wifi-planner
```

#### 2. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Modifica `.env` con un editor di testo:

```env
POSTGRES_DB=hamina
POSTGRES_USER=hamina_user
POSTGRES_PASSWORD=UnaPasswordSicura123!        # CAMBIA QUESTA
DATABASE_URL=postgresql+asyncpg://hamina_user:UnaPasswordSicura123!@postgres:5432/hamina
MINIO_ROOT_USER=hamina_minio
MINIO_ROOT_PASSWORD=UnaPasswordMinIO456!       # CAMBIA QUESTA
MINIO_ENDPOINT=minio:9000
SECRET_KEY=una-chiave-segreta-molto-lunga-e-casuale   # CAMBIA QUESTA
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=104857600
```

#### 3. Avvia i container

```bash
docker compose up -d --build
```

Il primo avvio richiede 5-10 minuti (download immagini + compilazione backend).

#### 4. Verifica che tutto funzioni

```bash
docker compose ps
```

Dovresti vedere 6 container in stato "Up":
- `hamina-planner-backend-1`
- `hamina-planner-frontend-1`
- `hamina-planner-nginx-1`
- `hamina-planner-postgres-1`
- `hamina-planner-minio-1`
- `hamina-planner-deepfloorplan-1`

#### 5. Accedi all'applicazione

Apri il browser su **http://localhost**

### Aggiornamento

```bash
git pull origin master
docker compose up -d --build
docker compose restart nginx
```

### Manuale d'Uso

#### Creare un Progetto

1. Apri http://localhost
2. Clicca **"+ Nuovo Progetto"**
3. Inserisci il nome del progetto (es. "Ufficio Via Roma")
4. Clicca **"Crea"** — si apre la pagina del progetto

#### Importare una Planimetria

1. Nella sidebar sinistra, clicca **"+ Carica Piano"**
2. Seleziona un file PDF o immagine (PNG, JPG) dal tuo PC
3. Dai un nome al piano (es. "Piano Terra")
4. La planimetria viene caricata e visualizzata

#### Calibrare la Scala (obbligatorio)

All'apertura di un nuovo piano appare un overlay blu:

1. Clicca **"Misura la scala"**
2. Clicca su un **primo punto** della planimetria di cui conosci la distanza reale
3. Muovi il mouse — vedrai una linea rossa di anteprima
4. Clicca sul **secondo punto**
5. Inserisci la **distanza reale in centimetri** (es. "500" per 5 metri)
6. La scala viene salvata e mostrata in alto (es. "Scala: 56.7 px/m")

#### Ruotare la Planimetria

1. In alto a destra della mappa trovi i bottoni **↺** e **↻**
2. Ogni click ruota la vista di 90° in senso antiorario o orario
3. La rotazione è solo visiva e non altera i dati salvati

#### Disegnare i Muri

1. Clicca il tool **"Muro"** nella toolbar
2. Seleziona il **materiale** dal menu a tendina (Cemento di default)
3. **Click sinistro** = inizio muro
4. **Muovi il mouse** = anteprima muro tratteggiato
5. **Click sinistro** = fine segmento, la catena continua
6. **Shift + click** = muro perfettamente orizzontale o verticale
7. **Click destro** = interrompi la catena
8. **Spacebar** = tieni premuto per spostare la vista (pan) mentre disegni
9. Per **cancellare**: passa a "Seleziona", poi doppio click sul muro > "OK"

#### Disegnare le Scaffalature (supermercati)

1. Clicca il tool **"Scaffali"** (🛒) nella toolbar
2. Seleziona il **tipo** dal menu a tendina:
   - **Scaffale vuoto** — attenuazione 5/8 dB (2.4/5 GHz)
   - **Scaffale pieno** — attenuazione 12/20 dB
   - **Scaffale freschi** — attenuazione 16/28 dB (prodotti refrigerati con umidità)
3. Disegna esattamente come i muri (catena continua, click destro per interrompere)
4. Ogni segmento mostra un'etichetta con il tipo di scaffale
5. La heatmap calcola automaticamente l'attenuazione dei segmenti attraversati

#### Piazzare gli Access Point

1. Clicca il tool **"AP"** nella toolbar
2. Clicca sulla planimetria dove vuoi posizionare l'AP
3. Inserisci un **nome** (es. "AP-01")
4. L'AP appare come cerchio blu con il nome

**Spostare un AP**: in modalità "Seleziona", trascina il cerchio blu
**Eliminare un AP**: doppio click sull'AP > conferma

#### Visualizzare la Heatmap del Segnale

1. Clicca **"Mostra Segnale"** nella toolbar
2. Seleziona la **frequenza**: 2.4 GHz o 5 GHz
3. Seleziona la **modalità**:
   - **Copertura** — colori dal verde (forte, >= -65 dBm) al marrone (debole, -75 dBm), trasparente sotto -80 dBm
   - **Overlap AP** — blu (1 AP), verde (2 AP, buono per roaming), rosso (3+ AP, interferenza)
4. Muovi il mouse sulla mappa per vedere il **valore dBm** nella legenda in basso

#### Misurare le Distanze

1. Clicca il tool **"Righello"** nella toolbar
2. Clicca il **punto di partenza**
3. Muovi il mouse — la distanza appare in tempo reale
4. Clicca il **punto di arrivo** — misura confermata
5. Terzo click = nuova misura

#### Esportare in PDF

1. Clicca il bottone **"PDF"** in alto a destra della mappa
2. Scegli dove salvare il file
3. Il PDF contiene: planimetria + muri + AP + heatmap (se attiva) + intestazione con info progetto

### Modello di Propagazione

Il calcolo del segnale WiFi utilizza un modello log-distance indoor calibrato sulle specifiche reali dell'Extreme Networks AP3000:

```
Path Loss (dB) = PL_ref + 10 * n * log10(d_3D) + clutter * d + Σ(wall_attenuation)
```

| Parametro | Valore |
|---|---|
| Esponente path loss (n) | 3.5 (commerciale denso) |
| Clutter ambientale | 0.3 dB/m |
| Altezza soffitto | 3.5 m |
| Distanza 3D | sqrt(d_orizzontale² + h_soffitto²) |
| Attenuazione cemento (2.4 GHz) | 12 dB |
| Attenuazione cemento (5 GHz) | 25 dB |
| Attenuazione cartongesso (2.4 GHz) | 3 dB |
| Attenuazione cartongesso (5 GHz) | 5 dB |
| Scaffale vuoto (2.4 GHz) | 5 dB |
| Scaffale vuoto (5 GHz) | 8 dB |
| Scaffale pieno (2.4 GHz) | 12 dB |
| Scaffale pieno (5 GHz) | 20 dB |
| Scaffale freschi (2.4 GHz) | 16 dB |
| Scaffale freschi (5 GHz) | 28 dB |

### Specifiche AP Supportati — Extreme Networks AP3000

| Parametro | 2.4 GHz | 5 GHz |
|---|---|---|
| TX Power max | 18 dBm | 18 dBm |
| Guadagno Antenna | 4.2 dBi | 5.07 dBi |
| EIRP calcolato | 22.2 dBm | 23.07 dBm |
| Sensibilità (MCS basso) | -94 dBm | -94 dBm |
| Sensibilità (HE80 MCS11) | -57 dBm | -57 dBm |
| MIMO | 2x2:2 | 2x2:2 |

### Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Backend | FastAPI + SQLAlchemy Async + PostgreSQL |
| Frontend | React 18 + Vite + Konva.js + Zustand |
| PDF Export | jsPDF |
| Infrastruttura | Docker Compose (6 container) |
| Proxy | Nginx Alpine |
| AI | TF2DeepFloorPlan |
| Storage | MinIO (S3-compatibile) |

### Autore

**Marco Mereu** — Network Engineer

---

## English

Web-based WiFi planning tool for positioning access points on floor plans. Simulates WiFi signal propagation using indoor path loss models with real Extreme Networks AP3000 access point specifications.

### Features

- **Floor plan import** — Upload PDF, DXF/DWG or images
- **Floor plan rotation** — Rotate the view by 90° (↺↻) to handle non-standard orientations
- **Mandatory scale calibration** — Required when opening each new floor
- **Wall drawing** — Continuous chain mode, multiple materials (concrete, drywall, glass, Low-E glass, brick, metal, doors, windows)
- **Supermarket shelving** — Dedicated 🛒 tool to draw shelves as orientable line segments; 3 types with realistic RF attenuation: Empty (5/8 dB), Full (12/20 dB), Refrigerated/wet (16/28 dB at 2.4/5 GHz)
- **AP placement** — Draggable blue icons with name label, double-click to delete
- **WiFi heatmap** — Two modes: Signal Coverage + AP Overlap (interference); shelving attenuation included in signal calculation
- **dBm tooltip** — Real-time signal value on mouse hover
- **Ruler tool** — Measure distances on the floor plan
- **PDF export** — Complete floor plan with APs, walls and heatmap
- **AI wall detection** — DeepFloorPlan

### System Requirements

- **Docker** >= 20.10 and **Docker Compose** >= 2.0
- **RAM**: minimum 4 GB (8 GB recommended for AI module)
- **Disk**: minimum 5 GB free space
- **Ports**: 80 (HTTP), 443 (HTTPS optional)
- **OS**: Linux (production), Windows/macOS (development)

### Step-by-Step Installation

#### 1. Clone the repository

```bash
git clone https://github.com/mmereu/wifi-planner.git
cd wifi-planner
```

#### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with a text editor:

```env
POSTGRES_DB=hamina
POSTGRES_USER=hamina_user
POSTGRES_PASSWORD=ASecurePassword123!          # CHANGE THIS
DATABASE_URL=postgresql+asyncpg://hamina_user:ASecurePassword123!@postgres:5432/hamina
MINIO_ROOT_USER=hamina_minio
MINIO_ROOT_PASSWORD=ASecureMinIOPassword456!   # CHANGE THIS
MINIO_ENDPOINT=minio:9000
SECRET_KEY=a-very-long-and-random-secret-key   # CHANGE THIS
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE=104857600
```

#### 3. Start the containers

```bash
docker compose up -d --build
```

First launch takes 5-10 minutes (image download + backend compilation).

#### 4. Verify everything is running

```bash
docker compose ps
```

You should see 6 containers with "Up" status:
- `hamina-planner-backend-1`
- `hamina-planner-frontend-1`
- `hamina-planner-nginx-1`
- `hamina-planner-postgres-1`
- `hamina-planner-minio-1`
- `hamina-planner-deepfloorplan-1`

#### 5. Access the application

Open your browser at **http://localhost**

### Updating

```bash
git pull origin master
docker compose up -d --build
docker compose restart nginx
```

### User Manual

#### Create a Project

1. Open http://localhost
2. Click **"+ Nuovo Progetto"** (New Project)
3. Enter the project name (e.g., "Office Via Roma")
4. Click **"Crea"** (Create) — the project page opens

#### Import a Floor Plan

1. In the left sidebar, click **"+ Carica Piano"** (Load Floor)
2. Select a PDF or image file (PNG, JPG) from your PC
3. Name the floor (e.g., "Ground Floor")
4. The floor plan loads and displays

#### Calibrate the Scale (mandatory)

When opening a new floor, a blue overlay appears:

1. Click **"Misura la scala"** (Measure the scale)
2. Click a **first point** on the floor plan where you know the real distance
3. Move the mouse — you'll see a red preview line
4. Click the **second point**
5. Enter the **real distance in centimeters** (e.g., "500" for 5 meters)
6. The scale is saved and shown at the top (e.g., "Scale: 56.7 px/m")

#### Rotate the Floor Plan

1. In the top-right corner of the map, use the **↺** and **↻** buttons
2. Each click rotates the view 90° counter-clockwise or clockwise
3. Rotation is visual only and does not affect saved data

#### Draw Walls

1. Click the **"Muro"** (Wall) tool in the toolbar
2. Select the **material** from the dropdown (Concrete by default)
3. **Left click** = start wall
4. **Move mouse** = dashed wall preview
5. **Left click** = end segment, chain continues
6. **Shift + click** = perfectly horizontal or vertical wall
7. **Right click** = stop the chain
8. **Spacebar** = hold to pan the view while drawing
9. To **delete**: switch to "Seleziona" (Select), then double-click on wall > confirm

#### Draw Shelving Units (supermarkets/warehouses)

1. Click the **"Scaffali"** (🛒) tool in the toolbar
2. Select the **type** from the dropdown:
   - **Scaffale vuoto** (Empty shelf) — 5/8 dB attenuation (2.4/5 GHz)
   - **Scaffale pieno** (Full shelf) — 12/20 dB attenuation
   - **Scaffale freschi** (Refrigerated shelf) — 16/28 dB attenuation (moisture content)
3. Draw exactly like walls (continuous chain, right-click to stop)
4. Each segment displays a label with the shelf type
5. The heatmap automatically accounts for shelf attenuation on crossed segments

#### Place Access Points

1. Click the **"AP"** tool in the toolbar
2. Click on the floor plan where you want to position the AP
3. Enter a **name** (e.g., "AP-01")
4. The AP appears as a blue circle with the name

**Move an AP**: in "Seleziona" (Select) mode, drag the blue circle
**Delete an AP**: double-click on the AP > confirm

#### View the Signal Heatmap

1. Click **"Mostra Segnale"** (Show Signal) in the toolbar
2. Select the **frequency**: 2.4 GHz or 5 GHz
3. Select the **mode**:
   - **Copertura** (Coverage) — colors from green (strong, >= -65 dBm) to brown (weak, -75 dBm), transparent below -80 dBm
   - **Overlap AP** — blue (1 AP), green (2 APs, good for roaming), red (3+ APs, interference)
4. Move the mouse on the map to see the **dBm value** in the bottom legend

#### Measure Distances

1. Click the **"Righello"** (Ruler) tool in the toolbar
2. Click the **start point**
3. Move the mouse — distance shown in real-time
4. Click the **end point** — measurement confirmed
5. Third click = new measurement

#### Export to PDF

1. Click the **"PDF"** button in the top-right of the map
2. Choose where to save the file
3. The PDF contains: floor plan + walls + APs + heatmap (if active) + header with project info

### Propagation Model

The WiFi signal calculation uses a log-distance indoor model calibrated on real Extreme Networks AP3000 specifications:

```
Path Loss (dB) = PL_ref + 10 * n * log10(d_3D) + clutter * d + sum(wall_attenuation)
```

| Parameter | Value |
|---|---|
| Path loss exponent (n) | 3.5 (dense commercial) |
| Environmental clutter | 0.3 dB/m |
| Ceiling height | 3.5 m |
| 3D distance | sqrt(horizontal_d² + ceiling_h²) |
| Concrete attenuation (2.4 GHz) | 12 dB |
| Concrete attenuation (5 GHz) | 25 dB |
| Drywall attenuation (2.4 GHz) | 3 dB |
| Drywall attenuation (5 GHz) | 5 dB |
| Empty shelf (2.4 GHz) | 5 dB |
| Empty shelf (5 GHz) | 8 dB |
| Full shelf (2.4 GHz) | 12 dB |
| Full shelf (5 GHz) | 20 dB |
| Refrigerated shelf (2.4 GHz) | 16 dB |
| Refrigerated shelf (5 GHz) | 28 dB |

### Supported AP Specifications — Extreme Networks AP3000

| Parameter | 2.4 GHz | 5 GHz |
|---|---|---|
| Max TX Power | 18 dBm | 18 dBm |
| Antenna Gain | 4.2 dBi | 5.07 dBi |
| Calculated EIRP | 22.2 dBm | 23.07 dBm |
| Sensitivity (low MCS) | -94 dBm | -94 dBm |
| Sensitivity (HE80 MCS11) | -57 dBm | -57 dBm |
| MIMO | 2x2:2 | 2x2:2 |

### Tech Stack

| Component | Technology |
|---|---|
| Backend | FastAPI + SQLAlchemy Async + PostgreSQL |
| Frontend | React 18 + Vite + Konva.js + Zustand |
| PDF Export | jsPDF |
| Infrastructure | Docker Compose (6 containers) |
| Proxy | Nginx Alpine |
| AI | TF2DeepFloorPlan |
| Storage | MinIO (S3-compatible) |

### Author

**Marco Mereu** — Network Engineer

---

## License

MIT License
