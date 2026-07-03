"""人脸检测 + 特征提取（InsightFace / ArcFace）。"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class DetectedFace:
    bbox: tuple[float, float, float, float]  # x1,y1,x2,y2
    det_score: float
    embedding: np.ndarray  # 512 维，已 L2 归一化（normed_embedding）
    pose: tuple[float, float, float] | None = None  # (pitch, yaw, roll) 角度，用于动作活体

    def area(self) -> float:
        x1, y1, x2, y2 = self.bbox
        return max(0.0, x2 - x1) * max(0.0, y2 - y1)


class FaceRecognizer:
    """封装 InsightFace 的 FaceAnalysis，懒加载模型，进程内单例。"""

    def __init__(self, model_name: str, det_size: int, providers: list[str]) -> None:
        # 延迟到构造时再 import，便于在未装依赖的环境里通过语法/契约检查
        from insightface.app import FaceAnalysis

        self._app = FaceAnalysis(name=model_name, providers=providers)
        self._app.prepare(ctx_id=0, det_size=(det_size, det_size))

    def detect(self, image_bgr: np.ndarray) -> list[DetectedFace]:
        faces = self._app.get(image_bgr)
        results: list[DetectedFace] = []
        for f in faces:
            bbox = tuple(float(v) for v in f.bbox.tolist())
            raw_pose = getattr(f, "pose", None)
            pose = tuple(float(v) for v in raw_pose) if raw_pose is not None else None
            results.append(
                DetectedFace(
                    bbox=bbox,  # type: ignore[arg-type]
                    det_score=float(getattr(f, "det_score", 0.0)),
                    embedding=np.asarray(f.normed_embedding, dtype=np.float32),
                    pose=pose,  # type: ignore[arg-type]
                )
            )
        return results

    @staticmethod
    def largest(faces: list[DetectedFace]) -> DetectedFace | None:
        if not faces:
            return None
        return max(faces, key=lambda x: x.area())
