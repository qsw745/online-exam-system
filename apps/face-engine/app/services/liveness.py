"""静默活体检测（Silent-Face / MiniFASNet）。

复用上游 minivision-ai/Silent-Face-Anti-Spoofing（Apache-2.0），其 src 与模型权重由
scripts/fetch_silent_face.sh 拉取并 vendoring 到 app/vendor/silent_face/。这里只做适配，
不重新实现 MiniFASNet。模型未就绪时优雅降级（ready=False），服务仍可提供特征提取。
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np


@dataclass
class LivenessResult:
    score: float
    is_real: bool


class SilentFaceLiveness:
    """对单帧 + 人脸框做静默活体打分。

    设计为懒加载：构造时尝试加载上游预测器与模型权重，任一缺失即抛异常，
    由工厂捕获后置为不可用。
    """

    def __init__(self, model_dir: str, threshold: float, device_id: int = 0) -> None:
        if not os.path.isdir(model_dir):
            raise FileNotFoundError(f"liveness model dir not found: {model_dir}")
        model_files = [f for f in os.listdir(model_dir) if f.endswith(".pth")]
        if not model_files:
            raise FileNotFoundError(f"no .pth liveness model in {model_dir}")

        # 把 vendoring 目录加进 sys.path，使上游 `from src.xxx` 绝对导入可解析
        import sys

        vendor_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "vendor", "silent_face"))
        if vendor_dir not in sys.path:
            sys.path.insert(0, vendor_dir)

        import torch
        from src.anti_spoof_predict import AntiSpoofPredict
        from src.generate_patches import CropImage
        from src.utility import parse_model_name

        # 上游 AntiSpoofPredict 继承的 Detection.__init__ 会加载 caffe 人脸检测器；
        # 我们用 InsightFace 提供 bbox，不需要它，故子类化跳过该初始化。
        class _Predictor(AntiSpoofPredict):  # type: ignore[misc, valid-type]
            def __init__(self, dev_id: int) -> None:
                self.device = torch.device(
                    "cuda:{}".format(dev_id) if torch.cuda.is_available() else "cpu"
                )

        self._predictor = _Predictor(device_id)
        self._cropper = CropImage()
        self._parse = parse_model_name
        self._model_dir = model_dir
        self._model_files = model_files
        self._threshold = threshold

    def predict(self, image_bgr: np.ndarray, bbox_xyxy: tuple[float, float, float, float]) -> LivenessResult:
        x1, y1, x2, y2 = bbox_xyxy
        bbox = [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]  # x,y,w,h

        prediction = np.zeros((1, 3))
        for name in self._model_files:
            h_input, w_input, _model_type, scale = self._parse(name)
            param = {
                "org_img": image_bgr,
                "bbox": bbox,
                "scale": scale,
                "out_w": w_input,
                "out_h": h_input,
                "crop": scale is not None,
            }
            patch = self._cropper.crop(**param)
            prediction += self._predictor.predict(patch, os.path.join(self._model_dir, name))

        label = int(np.argmax(prediction))
        score = float(prediction[0][label] / len(self._model_files))
        # 上游约定：label==1 为真人
        is_real = label == 1 and score >= self._threshold
        return LivenessResult(score=score, is_real=is_real)


def build_liveness(model_dir: str, threshold: float) -> SilentFaceLiveness | None:
    """构造活体检测器；任何依赖/模型缺失都返回 None（服务降级但不崩）。"""
    try:
        return SilentFaceLiveness(model_dir=model_dir, threshold=threshold)
    except Exception as exc:  # noqa: BLE001 - 降级路径，记录后继续
        import logging

        logging.getLogger("face-engine").warning("liveness disabled: %s", exc)
        return None
