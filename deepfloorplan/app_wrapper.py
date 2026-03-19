"""
Standalone Flask server for TF2DeepFloorplan inference.

Loads the model once at startup, then serves /upload and /uri endpoints.
"""
import os
import sys
import logging
import tempfile

# Suppress TF warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("deepfloorplan")

sys.path.insert(0, "/app")

from flask import Flask, request, jsonify, Response
import numpy as np
import cv2

app = Flask(__name__)

# Global model reference
_model = None
_model_loaded = False
_config = None


def load_model():
    """Load TF2DeepFloorplan model at startup."""
    global _model, _model_loaded, _config
    try:
        import toml
        config_path = "/app/docs/app.toml"
        if os.path.exists(config_path):
            _config = toml.load(config_path)
            logger.info(f"Config loaded: {_config}")

        import tensorflow as tf
        logger.info(f"TensorFlow {tf.__version__} loaded OK")

        # Try to load model using the dfp module
        try:
            from dfp.net import deepfloorplanModel
            model = deepfloorplanModel()

            weight_path = "/app/log/store/G"
            if os.path.exists(weight_path):
                # Try loading checkpoint
                checkpoint = tf.train.latest_checkpoint(weight_path)
                if checkpoint:
                    ckpt = tf.train.Checkpoint(net=model)
                    ckpt.restore(checkpoint).expect_partial()
                    logger.info(f"Model weights loaded from checkpoint: {checkpoint}")
                else:
                    # Try direct weight files
                    weight_files = [f for f in os.listdir(weight_path) if f.endswith(".index")]
                    if weight_files:
                        prefix = os.path.join(weight_path, weight_files[0].replace(".index", ""))
                        ckpt = tf.train.Checkpoint(net=model)
                        ckpt.restore(prefix).expect_partial()
                        logger.info(f"Model weights loaded from: {prefix}")
                    else:
                        logger.warning(f"No checkpoint found in {weight_path}: {os.listdir(weight_path)}")
                        return False

            _model = model
            _model_loaded = True
            logger.info("DeepFloorplan model ready")
            return True

        except ImportError as e:
            logger.error(f"Cannot import dfp modules: {e}")
            return False

    except Exception as e:
        logger.error(f"Model loading failed: {e}", exc_info=True)
        return False


def run_inference(image_path: str) -> np.ndarray:
    """Run inference on a single image, return the segmentation result."""
    import tensorflow as tf

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # Resize to 512x512 as expected by the model
    img_resized = cv2.resize(img_rgb, (512, 512))
    img_tensor = tf.convert_to_tensor(img_resized, dtype=tf.float32)
    img_tensor = img_tensor / 255.0
    img_tensor = tf.expand_dims(img_tensor, 0)

    # Run model
    logits_r, logits_cw = _model(img_tensor, training=False)

    # Process outputs
    # logits_cw: boundary classes [bg, opening, wall]
    # logits_r: room classes
    cw = tf.argmax(logits_cw, axis=-1).numpy()[0]  # (512, 512)
    r = tf.argmax(logits_r, axis=-1).numpy()[0]     # (512, 512)

    # Create colorized output
    result = np.zeros((512, 512, 3), dtype=np.uint8)

    # Room colors
    room_colors = {
        1: (224, 255, 224),   # Closet - light green
        2: (192, 224, 255),   # Bathroom - light blue
        3: (255, 224, 192),   # Living/Kitchen - light orange
        4: (255, 192, 224),   # Bedroom - light pink
        5: (224, 224, 255),   # Hall - light purple
        6: (192, 255, 224),   # Balcony - mint
    }
    for room_id, color in room_colors.items():
        result[r == room_id] = color

    # Walls = white (class 2 in boundary head)
    result[cw == 2] = (255, 255, 255)

    # Openings (doors/windows) = pink
    result[cw == 1] = (255, 60, 128)

    return result


@app.route("/")
def health():
    return jsonify({
        "message": "Hello Flask!",
        "model_loaded": _model_loaded,
    })


@app.route("/upload", methods=["POST"])
def upload():
    if not _model_loaded:
        return jsonify({"error": "Model not loaded"}), 503

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    try:
        # Save to temp file
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        file.save(tmp.name)
        tmp.close()

        # Run inference
        result = run_inference(tmp.name)

        # Encode as JPEG
        _, buffer = cv2.imencode(".jpg", cv2.cvtColor(result, cv2.COLOR_RGB2BGR))

        os.unlink(tmp.name)
        return Response(buffer.tobytes(), mimetype="image/jpeg")

    except Exception as e:
        logger.error(f"Inference failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    logger.info("Loading DeepFloorplan model...")
    success = load_model()
    if success:
        logger.info("Model loaded, starting Flask server on port 1111")
    else:
        logger.warning("Model NOT loaded — server will return 503 on /upload")
    app.run(host="0.0.0.0", port=1111)
