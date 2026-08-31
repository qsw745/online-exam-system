import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Route, sync_playwright


BASE_URL = "http://127.0.0.1:4173"
SCREENSHOT = Path("/tmp/wenheng-mobile-exam-phase4-permission-denied.png")
NORMAL_ATTEMPT_ID = "2a082a16-f02b-4874-83b6-d6a626d4b790"
STRICT_ATTEMPT_ID = "dd26d10f-e8f8-46bb-9a9c-17aa5e0e7035"
CONSENT_ID = "139036a0-6d91-46ef-9cce-3928dc7c6038"
SESSION_ID = "e8181bd5-d21a-4c42-91b8-e897bfdd7fd0"


def encode_segment(value: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(value).encode()).decode()
    return encoded.rstrip("=")


token = ".".join(
    [
        encode_segment({"alg": "none"}),
        encode_segment(
            {
                "id": 7,
                "email": "student@example.com",
                "type": "access",
                "roles": [{"id": 3, "code": "student"}],
                "data_region": "CN",
                "exp": 2_000_000_000,
            }
        ),
        "",
    ]
)

server_now = datetime.now(timezone.utc)
started_at = server_now - timedelta(minutes=1)
deadline_at = server_now + timedelta(minutes=20)
consent_payloads: list[dict] = []
session_payloads: list[dict] = []


def envelope(data, message="OK"):
    return {"success": True, "code": "OK", "status": 200, "message": message, "data": data}


def policy(level: str):
    strict = level == "strict"
    return {
        "enabled": strict,
        "level": level,
        "policyVersion": "wenheng-proctoring-2026-08-v1",
        "noticeVersion": "wenheng-proctoring-notice-2026-08-v1",
        "requireCamera": strict,
        "requireMic": strict,
        "requireIdentityVerification": strict,
        "eventRetentionDays": 180,
        "snapshotRetentionDays": 0,
        "heartbeatIntervalSeconds": 15,
        "interruptionGraceSeconds": 45,
        "notice": {
            "categories": ["camera", "microphone_status", "identity_verification", "factual_events"],
            "purpose": "核验本场考试身份并记录客观传感器与应用状态。",
            "processingLocation": "中国大陆账号区域的问衡服务",
            "cameraUsage": "用于身份核验与单人是否在场检测。",
            "microphoneUsage": "只检查权限和采集轨道状态，不分析声音内容。",
            "mediaUpload": "不持续上传音视频，只提交明确操作产生的有限身份核验画面。",
            "eventRetentionDays": 180,
            "snapshotRetentionDays": 0,
        },
    }


def exam(task_id: int, exam_id: int, attempt_id: str, level: str):
    return {
        "taskId": task_id,
        "examId": exam_id,
        "paperId": 31,
        "attemptId": attempt_id,
        "duration": 30,
        "status": "in_progress",
        "startedAt": started_at.isoformat().replace("+00:00", "Z"),
        "endTime": None,
        "deadlineAt": deadline_at.isoformat().replace("+00:00", "Z"),
        "serverNow": server_now.isoformat().replace("+00:00", "Z"),
        "title": "问衡普通考试" if level == "off" else "问衡严格监考考试",
        "description": "第四阶段手机端权限闸门验证",
        "questions": [
            {
                "id": 1,
                "type": "single_choice",
                "content": "严格监考权限应在何时申请？",
                "options": ["进入应用时", "阅读告知并单独同意后", "考试结束后"],
                "score": 10,
                "order": 1,
            }
        ],
        "antiCheat": {"level": "none", "maxSwitches": 999, "autoSubmit": False},
        "proctoring": policy(level),
    }


prepared_session = {
    "sessionId": SESSION_ID,
    "consentId": CONSENT_ID,
    "attemptId": STRICT_ATTEMPT_ID,
    "examId": 902,
    "taskId": 78,
    "state": "prepared",
    "lastSequence": 0,
    "cameraRequired": True,
    "microphoneRequired": True,
    "identityRequired": True,
    "identityStatus": "pending",
    "startedAt": None,
    "lastHeartbeatAt": None,
    "interruptionStartedAt": None,
    "completedAt": None,
    "reviewReasonCode": None,
}


def handle_api(route: Route):
    request = route.request
    path = urlparse(request.url).path
    if path.endswith("/users/me"):
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(envelope({"id": "7", "email": "student@example.com", "role": "student", "data_region": "CN"})),
        )
        return
    if path.endswith("/tasks/77/exam"):
        route.fulfill(status=200, content_type="application/json", body=json.dumps(envelope(exam(77, 901, NORMAL_ATTEMPT_ID, "off"))))
        return
    if path.endswith("/tasks/78/exam"):
        route.fulfill(status=200, content_type="application/json", body=json.dumps(envelope(exam(78, 902, STRICT_ATTEMPT_ID, "strict"))))
        return
    if path.endswith("/proctoring/consents"):
        consent_payloads.append(request.post_data_json)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(envelope({
                "consent": {"consentId": CONSENT_ID, "expiresAt": deadline_at.isoformat()},
                "policy": policy("strict"),
                "replayed": False,
            })),
        )
        return
    if path.endswith("/proctoring/sessions"):
        session_payloads.append(request.post_data_json)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(envelope({
                "session": prepared_session,
                "policy": policy("strict"),
                "decision": {"state": "prepared", "mayContinue": False, "action": "remain_paused"},
                "replayed": False,
            })),
        )
        return
    route.fulfill(status=200, content_type="application/json", body=json.dumps(envelope({})))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 393, "height": 852},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    context.add_init_script(
        f"sessionStorage.setItem('token', {json.dumps(token)});"
        "sessionStorage.setItem('userRole', 'student');"
        "localStorage.setItem('userRole', 'student');"
        "localStorage.setItem('auth_storage', 'session');"
        "window.__wenhengMediaRequests = 0;"
        "const deniedMediaDevices = {"
        "  getUserMedia: async () => {"
        "    window.__wenhengMediaRequests += 1;"
        "    throw new DOMException('Permission denied by verification harness', 'NotAllowedError');"
        "  }"
        "};"
        "Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: deniedMediaDevices });"
        "Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: 'denied' }) } });"
    )
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.route("**/api/**", handle_api)

    page.goto(f"{BASE_URL}/exam/77")
    page.get_by_role("heading", name="问衡普通考试").wait_for()
    page.wait_for_timeout(500)
    assert page.evaluate("window.__wenhengMediaRequests") == 0, "普通考试不得请求摄像头或麦克风"
    assert page.get_by_text("考前监考告知与单独同意", exact=True).count() == 0

    page.goto(f"{BASE_URL}/exam/78")
    page.get_by_role("heading", name="考前监考告知与单独同意").wait_for()
    assert page.evaluate("window.__wenhengMediaRequests") == 0, "阅读和同意前不得请求敏感权限"
    assert len(consent_payloads) == 0 and len(session_payloads) == 0, "同意前不得创建凭证或会话"

    page.get_by_text("我已阅读并单独同意本场严格监考的数据处理说明。").click()
    page.get_by_text("我单独同意仅为本场考试进行人脸身份核验。").click()
    page.get_by_role("button", name="同意并检查设备").click()
    page.get_by_role("heading", name="缺少严格监考所需权限").wait_for()
    assert page.evaluate("window.__wenhengMediaRequests") == 1, "确认后应且仅应请求一次媒体权限"
    assert len(consent_payloads) == 1 and len(session_payloads) == 1
    assert consent_payloads[0]["attemptId"] == STRICT_ATTEMPT_ID
    assert consent_payloads[0]["biometricConsent"] is True
    assert session_payloads[0] == {"examId": 902, "attemptId": STRICT_ATTEMPT_ID, "consentId": CONSENT_ID}
    assert page.get_by_role("button", name="打开系统设置").is_visible()
    assert page.get_by_role("button", name="退出考试").is_visible()
    assert page.get_by_text("问衡严格监考考试", exact=True).locator("..") is not None
    page.screenshot(path=str(SCREENSHOT), full_page=True)

    browser.close()

print(
    json.dumps(
        {
            "ok": True,
            "screenshot": str(SCREENSHOT),
            "normalMediaRequests": 0,
            "strictMediaRequestsAfterConsent": 1,
            "consentRequests": len(consent_payloads),
            "sessionRequests": len(session_payloads),
            "consoleErrors": console_errors,
        },
        ensure_ascii=False,
    )
)
