FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Disable oneDNN to prevent SIGSEGV on some CPU architectures
ENV TF_ENABLE_ONEDNN_OPTS=0
ENV TF_CPP_MIN_LOG_LEVEL=2

# Clone TF2DeepFloorplan
RUN git clone --depth 1 https://github.com/zcemycl/TF2DeepFloorplan.git /app
WORKDIR /app

# Install TF first, then force numpy downgrade
RUN pip install --no-cache-dir \
    "tensorflow-cpu==2.15.1" \
    "opencv-python-headless>=4.8.0" \
    "scipy>=1.11.0" \
    "Pillow>=10.0.0" \
    "flask>=3.0.0" \
    "matplotlib>=3.7.0" \
    "toml>=0.10.0" && \
    pip install --no-cache-dir --force-reinstall \
    "numpy==1.26.4" \
    "ml-dtypes==0.3.2"

# Try to install the package (may fail gracefully)
RUN pip install --no-cache-dir --no-deps -e . 2>/dev/null || true

# Download pretrained weights
RUN mkdir -p /app/log/store
COPY download_weights.py /app/download_weights.py
RUN python /app/download_weights.py || echo "Weights download may need manual setup"

COPY app_wrapper.py /app/app_wrapper.py

EXPOSE 1111

CMD ["python", "/app/app_wrapper.py"]
