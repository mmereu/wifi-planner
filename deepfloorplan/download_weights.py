"""
Download TF2DeepFloorplan pretrained weights.

Tries multiple sources since the official Google Drive links are often broken.
"""
import os
import shutil
import subprocess
import sys

WEIGHT_DIR = "/app/log/store/G"

def try_gdown():
    """Try downloading from Google Drive with gdown."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown", "-q"])
        import gdown
        # Log format weights (checkpoint files)
        url = "https://drive.google.com/uc?id=1czUSFvk6Z49H-zRikTc67g2HUUz4imON"
        output = "/tmp/model_weights.zip"
        gdown.download(url, output, quiet=False)
        if os.path.exists(output) and os.path.getsize(output) > 1000:
            subprocess.check_call(["python", "-m", "zipfile", "-e", output, "/tmp/weights_extract/"])
            # Find the actual weight files and move to correct location
            import glob
            for f in glob.glob("/tmp/weights_extract/**/G.*", recursive=True):
                dest = os.path.join(WEIGHT_DIR, os.path.basename(f))
                shutil.move(f, dest)
                print(f"  Moved {f} -> {dest}")
            for f in glob.glob("/tmp/weights_extract/**/checkpoint", recursive=True):
                dest = os.path.join(WEIGHT_DIR, "checkpoint")
                shutil.move(f, dest)
                print(f"  Moved checkpoint -> {dest}")
            print("Weights downloaded and arranged successfully via gdown")
            return True
    except Exception as e:
        print(f"gdown failed: {e}")
    return False


def try_huggingface():
    """Try downloading from HuggingFace Hub if someone has mirrored the weights."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub", "-q"])
        from huggingface_hub import hf_hub_download
        # Try common mirror locations
        for repo in ["zcemycl/TF2DeepFloorplan", "deepfloorplan/weights"]:
            try:
                path = hf_hub_download(repo_id=repo, filename="model_weights.zip")
                subprocess.check_call(["python", "-m", "zipfile", "-e", path, "/app/log/store/"])
                print(f"Weights downloaded from HuggingFace: {repo}")
                return True
            except Exception:
                continue
    except Exception as e:
        print(f"HuggingFace failed: {e}")
    return False


if __name__ == "__main__":
    os.makedirs(WEIGHT_DIR, exist_ok=True)

    # Check if weights already exist
    if any(f.endswith((".index", ".data-00000-of-00001")) for f in os.listdir(WEIGHT_DIR) if os.path.isfile(os.path.join(WEIGHT_DIR, f))):
        print("Weights already present, skipping download")
        sys.exit(0)

    success = try_gdown() or try_huggingface()

    if not success:
        print("""
╔══════════════════════════════════════════════════════════╗
║  WEIGHTS NOT AVAILABLE AUTOMATICALLY                     ║
║                                                          ║
║  Please manually download weights and place them in:     ║
║  deepfloorplan/weights/log/store/G/                      ║
║                                                          ║
║  The service will start but return errors until           ║
║  weights are provided.                                   ║
╚══════════════════════════════════════════════════════════╝
""")
        # Create a marker file so the wrapper knows weights are missing
        with open("/app/log/store/.no_weights", "w") as f:
            f.write("weights not downloaded")
