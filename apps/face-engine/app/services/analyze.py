"""把多帧图像跑成 per-frame 结果 + 聚合结果。"""
from __future__ import annotations

import numpy as np

from ..schemas import Aggregate, AnalyzeResponse, BBox, FrameResult, Liveness, Motion, Pose
from .image import decode_base64_image
from .liveness import SilentFaceLiveness
from .recognition import FaceRecognizer


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm > 0 else vec


def analyze_frames(
    images: list[str],
    recognizer: FaceRecognizer,
    liveness: SilentFaceLiveness | None,
    *,
    need_embedding: bool,
    need_liveness: bool,
    model_name: str,
    dim: int,
) -> AnalyzeResponse:
    frames: list[FrameResult] = []
    single_face_embeddings: list[np.ndarray] = []
    liveness_scores: list[float] = []
    liveness_reals: list[bool] = []
    yaws: list[float] = []
    pitches: list[float] = []

    for index, data in enumerate(images):
        try:
            image = decode_base64_image(data)
        except ValueError as exc:
            frames.append(FrameResult(index=index, face_count=0, error=str(exc)))
            continue

        faces = recognizer.detect(image)
        primary = FaceRecognizer.largest(faces)
        frame = FrameResult(index=index, face_count=len(faces))

        if primary is not None:
            frame.bbox = BBox(x1=primary.bbox[0], y1=primary.bbox[1], x2=primary.bbox[2], y2=primary.bbox[3])
            frame.det_score = primary.det_score
            if need_embedding:
                frame.embedding = primary.embedding.tolist()

            if primary.pose is not None:
                pitch, yaw, roll = primary.pose
                frame.pose = Pose(pitch=pitch, yaw=yaw, roll=roll)
                yaws.append(yaw)
                pitches.append(pitch)

            if need_liveness and liveness is not None:
                result = liveness.predict(image, primary.bbox)
                frame.liveness = Liveness(score=result.score, is_real=result.is_real)
                liveness_scores.append(result.score)
                liveness_reals.append(result.is_real)

            if len(faces) == 1:
                single_face_embeddings.append(primary.embedding)

        frames.append(frame)

    all_single_face = len(single_face_embeddings) == len(images) and len(images) > 0

    agg_embedding: list[float] | None = None
    if need_embedding and single_face_embeddings:
        mean = np.mean(np.stack(single_face_embeddings), axis=0)
        agg_embedding = _l2_normalize(mean).astype(np.float32).tolist()

    agg_liveness: Liveness | None = None
    if need_liveness and liveness_scores:
        # 多数帧聚合：达到 min_real_ratio 比例的帧判真即通过，分数取中位数。
        # 相比“全部判真+取最小分”，可抵抗采集期间个别模糊/角度帧，显著降低真人误拒。
        from ..config import get_settings

        min_ratio = get_settings().liveness_min_real_ratio
        real_ratio = sum(1 for r in liveness_reals if r) / len(liveness_reals)
        ordered = sorted(liveness_scores)
        mid = len(ordered) // 2
        median_score = ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2.0
        agg_liveness = Liveness(score=float(median_score), is_real=real_ratio >= min_ratio)

    agg_motion: Motion | None = None
    if yaws or pitches:
        agg_motion = Motion(
            yaw_range=(max(yaws) - min(yaws)) if yaws else 0.0,
            pitch_range=(max(pitches) - min(pitches)) if pitches else 0.0,
        )

    return AnalyzeResponse(
        model=model_name,
        dim=dim,
        frames=frames,
        aggregate=Aggregate(
            all_single_face=all_single_face,
            embedding=agg_embedding,
            liveness=agg_liveness,
            motion=agg_motion,
        ),
    )
