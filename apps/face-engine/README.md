# Face Engine（人脸识别引擎服务）

内网 only 的人脸识别微服务，供 Node 后端通过 HTTP + 共享密钥调用。提供：

- **人脸检测 + 特征提取**：InsightFace `buffalo_l`（RetinaFace + ArcFace r50），输出 **512 维** L2 归一化 embedding
- **静默活体**：Silent-Face / MiniFASNet（vendoring 上游，Apache-2.0）

> 识别内核与具体调用方解耦。Node 侧只把它当“可替换引擎”，将来换云 API 只改 Node 的 adapter。

## 目录

```
apps/face-engine/
├── app/
│   ├── main.py              # FastAPI 入口（启动加载模型）
│   ├── config.py            # 环境变量配置
│   ├── schemas.py           # API 契约（请求/响应）
│   ├── security.py          # 共享密钥校验
│   ├── services/
│   │   ├── image.py         # base64 → BGR
│   │   ├── recognition.py   # InsightFace 封装
│   │   ├── liveness.py      # Silent-Face 适配（缺模型时优雅降级）
│   │   └── analyze.py       # 多帧 → per-frame + 聚合
│   └── vendor/silent_face/  # 上游源码（由脚本拉取，.gitignore）
├── scripts/fetch_silent_face.sh
├── requirements.txt
├── .env.example
└── run.sh
```

## 启动

```bash
cd apps/face-engine
cp .env.example .env            # 修改 FACE_ENGINE_SHARED_SECRET
./scripts/fetch_silent_face.sh  # 拉取活体源码与模型（首次）
./run.sh                        # 建 venv、装依赖、起服务
```

首次运行时 InsightFace 会自动下载 `buffalo_l` 模型到 `~/.insightface`。
推荐 Python 3.10/3.11（onnxruntime / insightface 的 wheel 最稳；3.13 可能缺预编译包）。

## API 契约

所有业务接口需带请求头 `X-Engine-Secret: <FACE_ENGINE_SHARED_SECRET>`。

### `GET /healthz`

```json
{ "status": "ok", "version": "0.1.0", "recognizer_ready": true, "liveness_ready": true }
```

### `POST /v1/face/analyze`

请求：

```json
{
  "images": ["<base64 帧1>", "<base64 帧2>"],
  "need_embedding": true,
  "need_liveness": true
}
```

响应：

```json
{
  "model": "buffalo_l",
  "dim": 512,
  "frames": [
    {
      "index": 0,
      "face_count": 1,
      "bbox": { "x1": 100, "y1": 80, "x2": 220, "y2": 240 },
      "det_score": 0.99,
      "embedding": [0.01, -0.03, "...512 维..."],
      "liveness": { "score": 0.93, "is_real": true },
      "error": null
    }
  ],
  "aggregate": {
    "all_single_face": true,
    "embedding": [0.01, "...512 维（多帧归一化均值）..."],
    "liveness": { "score": 0.91, "is_real": true }
  }
}
```

**调用方（Node）约定**：
- 录入：要求 `aggregate.all_single_face === true` 且 `aggregate.liveness.is_real === true`，存 `aggregate.embedding`。
- 登录：同样校验活体与单脸，再用 `aggregate.embedding` 与库内 embedding 算余弦相似度（≥ 阈值放行）。
- `liveness` 为 `null` 表示活体未就绪（未拉取模型）——生产环境应视为不通过。

错误：`401` 密钥错误 / `422` 入参非法或帧数超限 / `503` 模型未就绪。
