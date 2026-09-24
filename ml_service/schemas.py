from typing import Dict

from pydantic import BaseModel, HttpUrl


class PredictRequest(BaseModel):
    image_url: HttpUrl


class PredictResponse(BaseModel):
    label: str
    confidence: float
    all_scores: Dict[str, float]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
