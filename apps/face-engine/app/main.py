"""FastAPI 入口：启动时加载模型，暴露 /healthz 与 /v1/face/analyze。"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status

from . import __version__
from .config import get_settings
from .schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse
from .security import require_engine_secret
from .services.analyze import analyze_frames
from .services.liveness import build_liveness
from .services.recognition import FaceRecognizer

logger = logging.getLogger("face-engine")

# 进程内单例（启动时填充）
_state: dict[str, object] = {"recognizer": None, "liveness": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("loading face recognizer: %s", settings.model_name)
    _state["recognizer"] = FaceRecognizer(
        model_name=settings.model_name,
        det_size=settings.det_size,
        providers=settings.provider_list,
    )
    if settings.liveness_enabled:
        _state["liveness"] = build_liveness(
            model_dir=settings.liveness_model_dir,
            threshold=settings.liveness_threshold,
        )
        if _state["liveness"] is None:
            logger.warning("liveness model not ready; analyze will omit liveness")
    yield
    _state.clear()


app = FastAPI(title="Face Engine", version=__version__, lifespan=lifespan)


@app.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=__version__,
        recognizer_ready=_state.get("recognizer") is not None,
        liveness_ready=_state.get("liveness") is not None,
    )


@app.post("/v1/face/analyze", response_model=AnalyzeResponse, dependencies=[Depends(require_engine_secret)])
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    settings = get_settings()
    recognizer = _state.get("recognizer")
    if recognizer is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="recognizer not ready")
    if len(req.images) > settings.max_frames:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"too many frames (max {settings.max_frames})",
        )

    return analyze_frames(
        req.images,
        recognizer=recognizer,  # type: ignore[arg-type]
        liveness=_state.get("liveness"),  # type: ignore[arg-type]
        need_embedding=req.need_embedding,
        need_liveness=req.need_liveness,
        model_name=settings.model_name,
        dim=512,
    )
