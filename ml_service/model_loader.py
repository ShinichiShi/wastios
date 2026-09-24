import os
from typing import Dict, List, Tuple

import torch
from PIL import Image


IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
DEFAULT_CLASS_NAMES = ["plastic", "metal", "organic"]


class TorchScriptWasteClassifier:
    def __init__(self, model_path: str, class_names: List[str] | None = None):
        self.model_path = model_path
        self.class_names = class_names or DEFAULT_CLASS_NAMES
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None

    def load(self) -> None:
        self.model = torch.jit.load(self.model_path, map_location=self.device)
        self.model.eval()

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def preprocess(self, image: Image.Image) -> torch.Tensor:
        image = image.convert("RGB")
        image = image.resize((224, 224))

        # Convert PIL image to float tensor in [0, 1], shape: CxHxW
        img_bytes = torch.ByteTensor(torch.ByteStorage.from_buffer(image.tobytes()))
        img_tensor = img_bytes.view(224, 224, 3).permute(2, 0, 1).float() / 255.0

        mean = torch.tensor(IMAGENET_MEAN).view(3, 1, 1)
        std = torch.tensor(IMAGENET_STD).view(3, 1, 1)
        img_tensor = (img_tensor - mean) / std

        return img_tensor.unsqueeze(0).to(self.device)

    @torch.no_grad()
    def predict(self, image: Image.Image) -> Tuple[str, float, Dict[str, float]]:
        if self.model is None:
            raise RuntimeError("Model is not loaded")

        x = self.preprocess(image)
        logits = self.model(x)
        probs = torch.softmax(logits, dim=1).squeeze(0)

        top_idx = int(torch.argmax(probs).item())
        top_label = self.class_names[top_idx]
        top_conf = float(probs[top_idx].item())

        all_scores = {
            self.class_names[i]: round(float(probs[i].item()), 6)
            for i in range(min(len(self.class_names), probs.shape[0]))
        }

        return top_label, round(top_conf, 6), all_scores


def load_from_env() -> TorchScriptWasteClassifier:
    model_path = os.getenv("MODEL_PATH", "model.pt")
    class_names_env = os.getenv("CLASS_NAMES", "")

    class_names = None
    if class_names_env.strip():
        class_names = [name.strip() for name in class_names_env.split(",") if name.strip()]

    classifier = TorchScriptWasteClassifier(model_path=model_path, class_names=class_names)
    classifier.load()
    return classifier
