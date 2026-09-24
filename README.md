# Wastios Monorepo — Run Guide

This repository contains the full smart-waste system:

- `hardware/` — ESP32 firmware (HC-SR04 + HTTP sender)
- `ml/` — PyTorch training project (TrashNet -> 3 classes)
- `ml_service/` — FastAPI TorchScript inference microservice
- `backend/` — Node.js + Express API (Firebase auth/db, S3 uploads, Socket.IO)
- `frontend/` — Vite + React dashboard (live updates + analytics)

---

## 1) Prerequisites

Install:

- Node.js `>= 18`
- npm
- Python `3.10+`
- Firebase project + service account
- AWS S3 bucket + credentials
- (Optional) Arduino IDE for ESP32 firmware

---

## 2) Recommended startup order

1. **ML Service** (`ml_service`)  
2. **Backend API** (`backend`)  
3. **Frontend Dashboard** (`frontend`)  
4. **ESP32 Firmware** (`hardware`) to send live sensor data

---

## 3) ML model training (optional, if you need to retrain)

From repo root:

```bash
cd ml
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train.py --data_dir /path/to/TrashNet --output_dir checkpoints
```

Expected outputs:

- `ml/checkpoints/best_model.pth`
- `ml/checkpoints/best_model_ts.pt`

Use `best_model_ts.pt` with the ML service (`MODEL_PATH`).

---

## 4) Run ML inference microservice

From repo root:

```bash
cd ml_service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export MODEL_PATH=/absolute/path/to/best_model_ts.pt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

- `GET http://localhost:8000/health`

Predict endpoint used by backend:

- `POST http://localhost:8000/predict`

---

## 5) Run backend API

From repo root:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at minimum:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `S3_BUCKET_NAME`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `ML_SERVICE_URL` (example: `http://localhost:8000/predict`)
- `FRONTEND_URL` (example: `http://localhost:5173`)

Then run:

```bash
npm install
npm run dev
```

Health check:

- `GET http://localhost:3000/health`

Key API routes:

- `POST /api/sensor-data`
- `POST /api/images/upload`
- `GET /api/analytics/bins`
- `GET /api/analytics/trends?bin_id=BIN_001&days=7`
- `GET /api/analytics/waste-stats`

Socket.IO namespace:

- `/ws`

Events:

- `bin_update`
- `classification_update`
- `bin_alert`

---

## 6) Run frontend dashboard

From repo root:

```bash
cd frontend
npm install
```

Create `.env` in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Run:

```bash
npm run dev
```

Open:

- `http://localhost:5173`

Login page stores token in localStorage. Use a valid Firebase ID token for protected backend routes (unless backend auth bypass is enabled for local dev).

---

## 7) Flash and run ESP32 firmware

Files:

- `hardware/main.ino`
- `hardware/config.h`

Steps:

1. Open `hardware/config.h` and set Wi-Fi + server IP.
2. In firmware, set backend server target to your backend host (same LAN as ESP32).
3. Build/upload with Arduino IDE (ESP32 board package installed).

Firmware behavior:

- Reads HC-SR04 distance
- Computes fill percentage
- Sends `POST /api/sensor-data` every 30s

---

## 8) Full local run checklist

- [ ] ML service running on `:8000`
- [ ] Backend running on `:3000`
- [ ] Frontend running on `:5173`
- [ ] Backend `.env` points `ML_SERVICE_URL` to ML service
- [ ] Frontend `.env` points `VITE_API_BASE_URL` to backend
- [ ] Firebase and S3 credentials valid
- [ ] ESP32 points to backend host

---

## 9) Useful one-liner startup (3 terminals)

Terminal 1:

```bash
cd ml_service && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000
```

Terminal 2:

```bash
cd backend && npm run dev
```

Terminal 3:

```bash
cd frontend && npm run dev
```
