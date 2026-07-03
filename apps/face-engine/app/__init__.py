"""人脸识别引擎服务（内网 only）。

提供人脸特征提取（InsightFace/ArcFace）与静默活体检测（Silent-Face）能力，
由 Node 后端通过内网 HTTP + 共享密钥调用。本服务不直接面向公网。
"""

__version__ = "0.1.0"
