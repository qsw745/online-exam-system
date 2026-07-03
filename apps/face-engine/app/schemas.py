"""请求/响应数据契约（API contract）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    # 一次"采集"对应的若干帧（base64，可带或不带 data:image 前缀）
    images: list[str] = Field(min_length=1)
    need_embedding: bool = True
    need_liveness: bool = True


class BBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class Liveness(BaseModel):
    score: float  # 真人置信度 [0,1]
    is_real: bool


class Pose(BaseModel):
    pitch: float
    yaw: float
    roll: float


class Motion(BaseModel):
    # 多帧间头姿变化幅度（度），用于动作活体判定
    yaw_range: float
    pitch_range: float


class FrameResult(BaseModel):
    index: int
    face_count: int
    bbox: BBox | None = None
    det_score: float | None = None
    embedding: list[float] | None = None  # 512 维，已 L2 归一化
    liveness: Liveness | None = None
    pose: Pose | None = None
    error: str | None = None


class Aggregate(BaseModel):
    # 所有"恰好一张脸"的帧聚合后的结果，供 Node 直接用于录入/比对
    all_single_face: bool
    embedding: list[float] | None = None  # 多帧归一化均值，再 L2 归一化
    liveness: Liveness | None = None  # score=各帧最小值，is_real=全部为真
    motion: Motion | None = None  # 头姿运动幅度


class AnalyzeResponse(BaseModel):
    model: str
    dim: int
    frames: list[FrameResult]
    aggregate: Aggregate


class HealthResponse(BaseModel):
    status: str
    version: str
    recognizer_ready: bool
    liveness_ready: bool
