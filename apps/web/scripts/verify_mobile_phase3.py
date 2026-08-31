import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Route, sync_playwright


BASE_URL = "http://127.0.0.1:4173"
SCREENSHOT = Path("/tmp/wenheng-mobile-exam-phase3-offline-queued.png")
ATTEMPT_ID = "6745d94e-7d93-4a39-b348-26d8a979ee7d"


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
started_at = server_now - timedelta(minutes=2)
deadline_at = server_now + timedelta(minutes=10)
submit_payloads: list[dict] = []


def envelope(data, message="OK"):
    return {"success": True, "code": "OK", "status": 200, "message": message, "data": data}


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
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                envelope(
                    {
                        "taskId": 77,
                        "examId": 901,
                        "paperId": 31,
                        "attemptId": ATTEMPT_ID,
                        "duration": 30,
                        "status": "in_progress",
                        "startedAt": started_at.isoformat().replace("+00:00", "Z"),
                        "endTime": None,
                        "deadlineAt": deadline_at.isoformat().replace("+00:00", "Z"),
                        "serverNow": server_now.isoformat().replace("+00:00", "Z"),
                        "title": "问衡移动端可靠性考试",
                        "description": "离线交卷与自动补交验证",
                        "questions": [
                            {
                                "id": 1,
                                "type": "single_choice",
                                "content": "2 + 2 等于多少？",
                                "options": ["3", "4", "5"],
                                "score": 10,
                                "order": 1,
                            }
                        ],
                        "antiCheat": {"level": "none", "maxSwitches": 999},
                        "proctoring": {"enabled": False, "level": "off", "requireCamera": False, "requireMic": False, "intervalMs": 4000},
                    }
                )
            ),
        )
        return
    if path.endswith("/tasks/77/submit"):
        submit_payloads.append(request.post_data_json)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                envelope(
                    {
                        "attemptId": ATTEMPT_ID,
                        "submissionId": request.post_data_json["submissionId"],
                        "score": 10,
                        "correctCount": 1,
                        "replayed": False,
                    },
                    "提交成功",
                )
            ),
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
    )
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.route("**/api/**", handle_api)

    page.goto(f"{BASE_URL}/exam/77")
    page.get_by_role("heading", name="问衡移动端可靠性考试").wait_for()
    page.get_by_text("4", exact=True).click()
    page.wait_for_timeout(600)

    context.set_offline(True)
    page.get_by_role("button", name="提交", exact=True).first.click()
    page.locator(".ant-modal-confirm-btns .ant-btn-primary").click()
    page.get_by_text("交卷已安全排队", exact=True).wait_for()
    page.locator(".ant-modal-confirm").wait_for(state="hidden")
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path=str(SCREENSHOT), full_page=True)

    context.set_offline(False)
    page.wait_for_url("**/results/901", timeout=10_000)

    assert len(submit_payloads) == 1, f"恢复联网应只发送一次交卷请求，实际为 {len(submit_payloads)}"
    payload = submit_payloads[0]
    assert payload["attemptId"] == ATTEMPT_ID
    assert payload["answers"] == {"1": "B"}
    assert len(payload["submissionId"]) == 36
    assert payload["time_spent"] >= 120
    draft_keys = page.evaluate("Object.keys(localStorage).filter(key => key.startsWith('wenheng:exam-draft:'))")
    assert draft_keys == [], f"服务端确认成功后应清除草稿，残留：{draft_keys}"

    browser.close()

print(
    json.dumps(
        {
            "ok": True,
            "screenshot": str(SCREENSHOT),
            "submissionId": submit_payloads[0]["submissionId"],
            "consoleErrors": console_errors,
        },
        ensure_ascii=False,
    )
)
