"""Explicit demo training; never overwrites the configured production artifact."""
import argparse
from app.services.training_pipeline import run_training

def train_demo(manifest_path, output_dir="artifacts/demo", **kwargs):
    return run_training(manifest_path, output_dir, demo=True, **kwargs)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--output-dir", default="artifacts/demo")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--pretrained", choices=["NONE", "IMAGENET1K_V2"], default="IMAGENET1K_V2")
    args = parser.parse_args()
    train_demo(args.manifest, args.output_dir, epochs=args.epochs, pretrained=args.pretrained)
