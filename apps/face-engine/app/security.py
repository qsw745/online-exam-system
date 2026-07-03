"""内网共享密钥校验。"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_engine_secret(x_engine_secret: str = Header(default="")) -> None:
    secret = get_settings().shared_secret
    # 未配置密钥时直接拒绝，避免“裸奔”服务被内网其它进程调用
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="engine shared secret not configured",
        )
    # 常量时间比较，防时序侧信道
    if not hmac.compare_digest(x_engine_secret, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid engine secret",
        )
