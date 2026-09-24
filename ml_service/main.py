import io
import os

import requests
from fastapi import FastAPI, HTTPException
from PIL import Image, UnidentifiedImageError

from model_loader import TorchScriptWasteClassifier, load_from_env
from schemas import HealthResponse, PredictRequest, PredictResponse

DOWNLOAD_TIMEOUT_SECONDS = float(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "10"))

app = FastAPI(title="Waste Classifier ML Service", version="1.0.0")
classifier: TorchScriptWasteClassifier | None = None


@app.on_event("startup")
def startup_event() -> None:
    global classifier
    classifier = load_from_env()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=bool(classifier and classifier.loaded))


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    global classifier

    if classifier is None or not classifier.loaded:
        raise HTTPException(status_code=500, detail="Model not loaded")

    try:
        response = requests.get(str(payload.image_url), timeout=DOWNLOAD_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=422, detail=f"Failed to download image: {exc}") from exc

    try:
        image = Image.open(io.BytesIO(response.content))
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=422, detail="Downloaded content is not a valid image") from exc

    try:
        label, confidence, all_scores = classifier.predict(image)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    return PredictResponse(label=label, confidence=confidence, all_scores=all_scores)
