# Waste Image Classification (TrashNet -> 3 Classes)

PyTorch transfer-learning project for classifying waste into:

- `plastic`
- `metal`
- `organic`

Base model: **MobileNetV2 pretrained on ImageNet**, with fine-tuning on the last 30 parameter layers/tensors of the backbone plus classifier head.

## 1) Dataset setup (TrashNet)

This project expects TrashNet folder structure like:

```text
TrashNet/
  cardboard/
  glass/
  metal/
  paper/
  plastic/
  trash/
```

### Label remapping to 3 classes

- `cardboard` -> `organic`
- `paper` -> `organic`
- `trash` -> `organic`
- `glass` -> `plastic` (loosely)
- `plastic` -> `plastic`
- `metal` -> `metal`

### Download TrashNet

One popular source is the public TrashNet dataset repository. You can clone/download and point `--data_dir` to the dataset root containing the six class folders.

Example (after download):

```text
/path/to/TrashNet
```

## 2) Install dependencies

From the `ml` folder:

```bash
pip install -r requirements.txt
```

## 3) Train

Default training config:

- Epochs: `20`
- Batch size: `32`
- Optimizer: `Adam`
- LR: `1e-4`
- LR scheduler: `CosineAnnealingLR`
- Best checkpoint selected by validation accuracy

Run:

```bash
python train.py --data_dir /path/to/TrashNet --output_dir checkpoints
```

Outputs:

- `checkpoints/best_model.pth` (best checkpoint)
- `checkpoints/best_model_ts.pt` (TorchScript export)
- `checkpoints/training_summary.json`

## 4) Inference

Run single-image inference:

```bash
python infer.py --image /path/to/image.jpg --model checkpoints/best_model.pth
```

Or using TorchScript model:

```bash
python infer.py --image /path/to/image.jpg --model checkpoints/best_model_ts.pt
```

Example returned object:

```python
{"label": "plastic", "confidence": 0.94}
```

## 5) Files

- `model.py` - model creation + transforms
- `train.py` - training pipeline + checkpointing + TorchScript export
- `infer.py` - inference utility function and CLI
- `requirements.txt` - Python dependencies
