from typing import Tuple

import torch
import torch.nn as nn
from torchvision import models, transforms

# ImageNet normalization constants (required for pretrained backbones)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_transforms(train: bool = True) -> transforms.Compose:
    """Build data transforms for training/validation.

    Training: resize + augmentation + normalization
    Validation/Inference: resize + normalization
    """
    if train:
        return transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomRotation(degrees=15),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
                transforms.ToTensor(),
                transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
            ]
        )

    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ]
    )


def build_model(num_classes: int = 3, fine_tune_last_n: int = 30) -> nn.Module:
    """Create MobileNetV2 transfer-learning model.

    - Loads ImageNet pretrained weights
    - Replaces classifier head for the target class count
    - Freezes all backbone weights first
    - Unfreezes classifier + last `fine_tune_last_n` backbone parameter tensors
    """
    try:
        # torchvision >= 0.13 style
        backbone = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    except AttributeError:
        # fallback for older versions
        backbone = models.mobilenet_v2(pretrained=True)

    # Replace classifier head
    in_features = backbone.classifier[1].in_features
    backbone.classifier[1] = nn.Linear(in_features, num_classes)

    # Freeze everything
    for p in backbone.parameters():
        p.requires_grad = False

    # Always train classifier
    for p in backbone.classifier.parameters():
        p.requires_grad = True

    # Fine-tune last N parameter tensors in feature extractor
    feature_params = list(backbone.features.parameters())
    if fine_tune_last_n > 0:
        for p in feature_params[-fine_tune_last_n:]:
            p.requires_grad = True

    return backbone


def count_trainable_params(model: nn.Module) -> Tuple[int, int]:
    """Return (trainable, total) parameter counts."""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return trainable, total
