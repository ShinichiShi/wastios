import argparse
from pathlib import Path
from typing import Dict, List, Optional

import torch
from PIL import Image

from model import build_model, get_transforms

DEFAULT_CLASS_NAMES = ["plastic", "metal", "organic"]


def _load_pytorch_checkpoint(
    model_path: str, device: torch.device
) -> tuple[torch.nn.Module, List[str]]:
    checkpoint = torch.load(model_path, map_location=device)
    class_names = checkpoint.get("class_names", DEFAULT_CLASS_NAMES)

    model = build_model(num_classes=len(class_names), fine_tune_last_n=30)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()
    return model, class_names


def _load_torchscript_model(
    model_path: str, device: torch.device, class_names: Optional[List[str]] = None
) -> tuple[torch.jit.ScriptModule, List[str]]:
    model = torch.jit.load(model_path, map_location=device)
    model.eval()
    return model, class_names or DEFAULT_CLASS_NAMES


def load_model(
    model_path: str,
    device: Optional[str] = None,
    class_names: Optional[List[str]] = None,
):
    """Load either .pth checkpoint or TorchScript .pt model."""
    dev = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
    suffix = Path(model_path).suffix.lower()

    if suffix == ".pth":
        return _load_pytorch_checkpoint(model_path, dev), dev

    # Assume TorchScript otherwise (e.g., .pt)
    return _load_torchscript_model(model_path, dev, class_names), dev


def predict_image(
    image_path: str,
    model_path: str = "checkpoints/best_model.pth",
    device: Optional[str] = None,
    class_names: Optional[List[str]] = None,
) -> Dict[str, float | str]:
    """Run inference on one image.

    Returns:
        {"label": "plastic", "confidence": 0.94}
    """
    (model, loaded_class_names), dev = load_model(model_path, device=device, class_names=class_names)

    tfm = get_transforms(train=False)
    img = Image.open(image_path).convert("RGB")
    x = tfm(img).unsqueeze(0).to(dev)

    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)
        conf, pred_idx = torch.max(probs, dim=1)

    label = loaded_class_names[pred_idx.item()]
    confidence = round(float(conf.item()), 4)

    return {"label": label, "confidence": confidence}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inference for waste classifier")
    parser.add_argument("--image", type=str, required=True, help="Path to input image")
    parser.add_argument(
        "--model",
        type=str,
        default="checkpoints/best_model.pth",
        help="Path to model (.pth or TorchScript .pt)",
    )
    parser.add_argument("--device", type=str, default=None, help="cpu or cuda")

    args = parser.parse_args()

    result = predict_image(args.image, model_path=args.model, device=args.device)
    print(result)
