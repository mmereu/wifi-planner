FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    poppler-utils \
    gcc \
    python3-dev \
    build-essential \
    autoconf \
    automake \
    libtool \
    git \
    libpcre2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/LibreDWG/libredwg.git /tmp/libredwg \
    && cd /tmp/libredwg \
    && sh autogen.sh \
    && ./configure --disable-docs --enable-release \
    && make -j$(nproc) \
    && make install \
    && ldconfig \
    && rm -rf /tmp/libredwg

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY app/ app/

RUN mkdir -p /app/uploads

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
