# Wastios Backend API

Production-ready Node.js + Express REST API for sensor ingestion, image upload, ML inference integration, and analytics.

## Stack

- Node.js + Express
- Firebase Auth + Firestore (Firebase Admin SDK)
- AWS S3 SDK v3
- dotenv for environment configuration
- Winston structured JSON logging (with `req.id`)
- express-validator for request validation
- Centralized 400/404/500 error handling

## Project Structure

```text
src/
  routes/
    sensor.js
    image.js
    analytics.js
  controllers/
    sensorController.js
    imageController.js
    analyticsController.js
  services/
    sensorService.js
    imageService.js
    mlService.js
    analyticsService.js
  models/
    SensorReading.js
    WasteImage.js
    index.js
  middleware/
    auth.js
    errorHandler.js
    logger.js
  config/
    db.js
    s3.js
    env.js
app.js
server.js
```

## Setup

1. Copy env template:

```bash
cp .env.example .env
```

2. Update `.env` with valid Firebase, S3, and ML service values.

3. Install dependencies:

```bash
npm install
```

4. Run API:

```bash
npm run dev
```

Health check:

```text
GET /health
```

## Endpoints

### 1) POST /api/sensor-data
Stores sensor reading in `sensor_readings`.

Request body:

```json
{
  "bin_id": "BIN_001",
  "fill_level": 68.5,
  "timestamp": 1713181299000
}
```

### 2) POST /api/images/upload
Multipart upload with fields:

- `bin_id` (text)
- `image` (file)

Flow:
1. Upload image to S3
2. Save image record in `waste_images`
3. Call ML inference service (`ML_SERVICE_URL`) with image URL
4. Store `label` and `confidence`

### 3) GET /api/analytics/bins
Returns latest fill level per `bin_id`.

### 4) GET /api/analytics/trends?bin_id=BIN_001&days=7
Returns timeseries of fill levels for given bin and day window.

### 5) GET /api/analytics/waste-stats
Returns total counts and percentage breakdown by waste label.

## Notes

- Pass Firebase ID token in `Authorization: Bearer <token>` for protected endpoints.
- For local development only, you can set `FIREBASE_AUTH_BYPASS=true`.
- Firestore collections used by the API:
  - `sensor_readings`
  - `waste_images`
