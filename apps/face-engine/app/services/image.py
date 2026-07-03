"""图像解码：base64 → OpenCV BGR ndarray。"""
from __future__ import annotations

import base64
import binascii

import cv2
import numpy as np


def decode_base64_image(data: str) -> np.ndarray:
    """把（可能带 data URL 前缀的）base64 解码成 BGR 图像。

    解码失败抛 ValueError，由上层转成 400。
    """
    raw = data.strip()
    if raw.startswith("data:"):
        # data:image/png;base64,xxxx
        _, _, raw = raw.partition(",")
    try:
        buf = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("invalid base64 image") from exc

    arr = np.frombuffer(buf, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("cannot decode image bytes")
    return image
