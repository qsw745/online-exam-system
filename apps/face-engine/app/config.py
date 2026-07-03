"""服务配置：全部来自环境变量，启动时校验。"""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FACE_ENGINE_", env_file=".env", extra="ignore")

    # 服务绑定（默认只听本机回环，避免暴露到内网外）
    host: str = "127.0.0.1"
    port: int = 8077

    # Node 调用时必须携带的共享密钥（X-Engine-Secret）
    shared_secret: str = Field(default="", description="与 Node 后端约定的内网调用密钥")

    # 识别模型（InsightFace）
    model_name: str = "buffalo_l"
    det_size: int = 640
    # onnxruntime providers，逗号分隔；CPU 环境用 CPUExecutionProvider
    providers: str = "CPUExecutionProvider"

    # 活体（Silent-Face / MiniFASNet）
    liveness_enabled: bool = True
    liveness_model_dir: str = "./models/silent_face"
    liveness_threshold: float = 0.5
    # 多帧活体：达到该比例的帧判为真人即整体通过（抗个别坏帧，显著降低真人误拒）
    liveness_min_real_ratio: float = 0.5

    # 单次请求最多接收多少帧，防滥用（与 Node 端 validateFaceFrames 上限保持一致）
    max_frames: int = 16

    @property
    def provider_list(self) -> list[str]:
        return [p.strip() for p in self.providers.split(",") if p.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
