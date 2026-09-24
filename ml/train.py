import argparse
import json
import os
import random
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.optim import Adam
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader, Dataset
from torchvision.datasets import ImageFolder
from torchvision.datasets.folder import default_loader
from tqdm import tqdm

from model import build_model, count_trainable_params, get_transforms

# Final target classes required by the project
TARGET_CLASSES = ["plastic", "metal", "organic"]

# TrashNet 6 classes mapped into 3 classes
# - cardboard + paper -> organic
# - glass -> plastic (loosely)
# - metal -> metal
# - plastic -> plastic
# - trash -> organic (practical fallback)
CLASS_REMAP = {
    "cardboard": "organic",
    "paper": "organic",
    "trash": "organic",
    "glass": "plastic",
    "plastic": "plastic",
    "metal": "metal",
}


class RemappedTrashNet(Dataset):
    """Dataset that remaps original TrashNet labels into 3 target labels."""

    def __init__(self, samples: Sequence[Tuple[str, int]], transform=None):
        self.samples = list(samples)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label = self.samples[idx]
        img = default_loader(img_path)
        if self.transform:
            img = self.transform(img)
        return img, label


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def build_remapped_samples(dataset_root: str) -> List[Tuple[str, int]]:
    """Load TrashNet with ImageFolder and remap labels to target classes."""
    base = ImageFolder(root=dataset_root)
    remapped_samples: List[Tuple[str, int]] = []

    for img_path, old_idx in base.samples:
        old_class = base.classes[old_idx].lower().strip()
        if old_class not in CLASS_REMAP:
            continue

        new_class_name = CLASS_REMAP[old_class]
        new_idx = TARGET_CLASSES.index(new_class_name)
        remapped_samples.append((img_path, new_idx))

    if not remapped_samples:
        raise RuntimeError(
            "No usable images found. Check dataset path and class folder names "
            "(expected TrashNet classes like cardboard, glass, metal, paper, plastic, trash)."
        )

    return remapped_samples


def stratified_split(
    samples: Sequence[Tuple[str, int]], val_ratio: float = 0.2, seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Simple stratified split to keep class balance in train/val."""
    rng = random.Random(seed)
    by_class: Dict[int, List[Tuple[str, int]]] = defaultdict(list)

    for item in samples:
        by_class[item[1]].append(item)

    train_samples: List[Tuple[str, int]] = []
    val_samples: List[Tuple[str, int]] = []

    for cls_idx, cls_items in by_class.items():
        rng.shuffle(cls_items)
        n_val = max(1, int(len(cls_items) * val_ratio))
        val_samples.extend(cls_items[:n_val])
        train_samples.extend(cls_items[n_val:])

        if len(cls_items[n_val:]) == 0:
            raise RuntimeError(
                f"Class index {cls_idx} has too few images for train/val split. "
                "Add more samples or reduce val_ratio."
            )

    rng.shuffle(train_samples)
    rng.shuffle(val_samples)
    return train_samples, val_samples


def accuracy_from_logits(logits: torch.Tensor, targets: torch.Tensor) -> float:
    preds = torch.argmax(logits, dim=1)
    correct = (preds == targets).sum().item()
    return correct / targets.size(0)


def run_one_epoch(model, loader, criterion, optimizer, device, train: bool = True):
    if train:
        model.train()
    else:
        model.eval()

    running_loss = 0.0
    running_correct = 0
    running_total = 0

    pbar = tqdm(loader, desc="Train" if train else "Val", leave=False)

    for images, targets in pbar:
        images = images.to(device)
        targets = targets.to(device)

        if train:
            optimizer.zero_grad(set_to_none=True)

        with torch.set_grad_enabled(train):
            logits = model(images)
            loss = criterion(logits, targets)

            if train:
                loss.backward()
                optimizer.step()

        batch_size = targets.size(0)
        running_loss += loss.item() * batch_size
        running_correct += (logits.argmax(dim=1) == targets).sum().item()
        running_total += batch_size

        pbar.set_postfix(loss=f"{loss.item():.4f}")

    epoch_loss = running_loss / max(1, running_total)
    epoch_acc = running_correct / max(1, running_total)
    return epoch_loss, epoch_acc


def main(args):
    set_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    all_samples = build_remapped_samples(args.data_dir)
    train_samples, val_samples = stratified_split(all_samples, args.val_split, args.seed)

    train_ds = RemappedTrashNet(train_samples, transform=get_transforms(train=True))
    val_ds = RemappedTrashNet(val_samples, transform=get_transforms(train=False))

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    model = build_model(num_classes=len(TARGET_CLASSES), fine_tune_last_n=30).to(device)
    trainable, total = count_trainable_params(model)
    print(f"Trainable params: {trainable:,} / {total:,}")

    criterion = nn.CrossEntropyLoss()
    optimizer = Adam((p for p in model.parameters() if p.requires_grad), lr=args.lr)
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    best_ckpt_path = output_dir / "best_model.pth"
    best_ts_path = output_dir / "best_model_ts.pt"
    best_val_acc = -1.0
    best_epoch = -1

    for epoch in range(1, args.epochs + 1):
        print(f"\nEpoch [{epoch}/{args.epochs}]")
        train_loss, train_acc = run_one_epoch(
            model, train_loader, criterion, optimizer, device, train=True
        )
        val_loss, val_acc = run_one_epoch(
            model, val_loader, criterion, optimizer, device, train=False
        )
        scheduler.step()

        print(
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} | "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "class_names": TARGET_CLASSES,
                    "val_accuracy": float(best_val_acc),
                    "epoch": int(best_epoch),
                },
                best_ckpt_path,
            )
            print(f"Saved best checkpoint to: {best_ckpt_path}")

    print(f"\nBest val accuracy: {best_val_acc:.4f} at epoch {best_epoch}")

    # Export best model to TorchScript for production
    checkpoint = torch.load(best_ckpt_path, map_location="cpu")
    model_cpu = build_model(num_classes=len(TARGET_CLASSES), fine_tune_last_n=30)
    model_cpu.load_state_dict(checkpoint["model_state_dict"])
    model_cpu.eval()

    scripted_model = torch.jit.script(model_cpu)
    scripted_model.save(str(best_ts_path))
    print(f"Exported TorchScript model to: {best_ts_path}")

    # Save small metadata file for convenience
    metadata = {
        "class_names": TARGET_CLASSES,
        "best_val_accuracy": best_val_acc,
        "best_epoch": best_epoch,
        "checkpoint": str(best_ckpt_path),
        "torchscript": str(best_ts_path),
    }
    with open(output_dir / "training_summary.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train TrashNet 3-class classifier with MobileNetV2")
    parser.add_argument("--data_dir", type=str, required=True, help="Path to TrashNet root directory")
    parser.add_argument("--output_dir", type=str, default="checkpoints", help="Where to save models")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--val_split", type=float, default=0.2, help="Validation split ratio")
    parser.add_argument("--num_workers", type=int, default=4, help="DataLoader workers")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()
    main(args)
