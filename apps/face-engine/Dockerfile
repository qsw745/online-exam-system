# 人脸引擎（FastAPI + InsightFace + Silent-Face 活体），CPU 推理。
# buffalo_l 识别模型不打进镜像，运行时挂载到 /root/.insightface（见 docker-compose.prod.yml）。
# 与开发环境对齐（Python 3.13 / numpy 2.5 / torch 2.12.1）
FROM python:3.13-slim

# 国内构建：apt 换腾讯云源；libgl1/libglib2.0 是 insightface 连带安装的 opencv-python 运行所需
RUN sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources \
  && apt-get update \
  && apt-get install -y --no-install-recommends build-essential libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/face-engine

# CPU 版 torch 走阿里云 pytorch-wheels 镜像（官方 cpu 索引国内超时）；
# PyPI 默认 wheel 会附带数 GB 的 CUDA 依赖，必须显式指定 +cpu 版本
RUN pip install --no-cache-dir "torch==2.12.1+cpu" \
      -f https://mirrors.aliyun.com/pytorch-wheels/cpu/ \
      -i https://mirrors.cloud.tencent.com/pypi/simple

COPY requirements.txt ./
# 先锁定与开发环境一致的已验证版本组合，再补齐其余依赖
RUN pip install --no-cache-dir -i https://mirrors.cloud.tencent.com/pypi/simple \
      "numpy==2.5.0" "onnxruntime==1.27.0" "insightface==1.0.1" \
  && pip install --no-cache-dir -i https://mirrors.cloud.tencent.com/pypi/simple -r requirements.txt

COPY app ./app
COPY models ./models

ENV FACE_ENGINE_HOST=0.0.0.0 \
    FACE_ENGINE_PORT=8077

EXPOSE 8077
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8077"]
