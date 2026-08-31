import base64
import copy
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Route, TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = "http://127.0.0.1:4173"
SCREENSHOT = Path("/tmp/wenheng-mobile-proctoring-review-phase5.png")
APPEAL_SCREENSHOT = Path("/tmp/wenheng-mobile-proctoring-review-phase5-appeal.png")
CASE_ID = "7395c0a5-90c2-4db2-a7f1-eccf6327945d"
ATTEMPT_ID = "81c75367-fb18-42f4-8b97-b8f5c36f8a0c"
FIRST_MESSAGE_ID = "747b4fc9-de33-4a4f-824e-40081204271c"
SECOND_MESSAGE_ID = "e963298c-493f-41a2-a5fe-b65c933d68a2"


def encode_segment(value: dict) -> str:
    encoded = base64.urlsafe_b64encode(json.dumps(value).encode()).decode()
    return encoded.rstrip("=")


token = ".".join(
    [
        encode_segment({"alg": "none"}),
        encode_segment(
            {
                "id": 71,
                "email": "candidate@example.com",
                "type": "access",
                "roles": [{"id": 3, "code": "student"}],
                "data_region": "CN",
                "exp": 2_000_000_000,
            }
        ),
        "",
    ]
)

now = datetime.now(timezone.utc)
opened_at = now - timedelta(hours=2)
appeal_deadline = now + timedelta(days=7)


def iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")


def envelope(data, message="OK"):
    return {"success": True, "code": "OK", "status": 200, "message": message, "data": data}


def failure(code: str, status: int, message: str):
    return {"success": False, "code": code, "status": status, "message": message}


def initial_case() -> dict:
    return {
        "caseId": CASE_ID,
        "examId": 12,
        "taskId": 30,
        "attemptId": ATTEMPT_ID,
        "examTitle": "问衡产品能力测评",
        "status": "information_requested",
        "outcome": "pending",
        "triggerReasonCode": "MULTIPLE_FACES",
        "version": 2,
        "openedAt": iso(opened_at),
        "firstDecidedAt": None,
        "appealDeadlineAt": None,
        "closedAt": None,
        "updatedAt": iso(now - timedelta(minutes=30)),
        "decisions": [
            {
                "action": "request_information",
                "reasonCode": "CANDIDATE_EXPLANATION_REQUIRED",
                "createdAt": iso(now - timedelta(minutes=30)),
            }
        ],
        "messages": [
            {
                "messageId": FIRST_MESSAGE_ID,
                "messageType": "information_request",
                "replyToMessageId": None,
                "body": "请说明摄像头中断的设备情况。",
                "createdAt": iso(now - timedelta(minutes=30)),
            }
        ],
        "appeal": None,
    }


current_case = initial_case()
response_payloads: list[dict] = []
appeal_payloads: list[dict] = []
version_conflict_seen = False


def candidate_list_item(detail: dict) -> dict:
    keys = [
        "caseId",
        "examId",
        "taskId",
        "attemptId",
        "examTitle",
        "status",
        "outcome",
        "triggerReasonCode",
        "version",
        "openedAt",
        "firstDecidedAt",
        "appealDeadlineAt",
        "closedAt",
        "updatedAt",
    ]
    return {key: detail[key] for key in keys}


def result_detail() -> dict:
    return {
        "id": 501,
        "user_id": 71,
        "exam_id": 12,
        "attempt_id": ATTEMPT_ID,
        "paper_id": 8,
        "paper_title": "问衡产品能力测评",
        "score": 88,
        "total_score": 100,
        "percentage": 88,
        "duration": 1620,
        "start_time": iso(now - timedelta(minutes=30)),
        "end_time": iso(now - timedelta(minutes=3)),
        "status": "graded",
        "questions": [
            {
                "id": 1,
                "type": "single_choice",
                "content": "产品验证首先关注什么？",
                "options": ["真实需求", "功能数量", "页面动画"],
                "score": 10,
                "order": 1,
                "user_answer": "A",
                "correct_answer": "A",
                "is_correct": 1,
            }
        ],
    }


def fulfill_json(route: Route, body: dict, status: int = 200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def handle_api(route: Route):
    global current_case, version_conflict_seen
    request = route.request
    parsed = urlparse(request.url)
    path = parsed.path.rstrip("/")

    if path.endswith("/users/me"):
        fulfill_json(
            route,
            envelope({"id": "71", "email": "candidate@example.com", "role": "student", "data_region": "CN"}),
        )
        return
    if path.endswith("/results/501"):
        fulfill_json(route, envelope(result_detail()))
        return
    if path.endswith("/proctoring/exams/12"):
        fulfill_json(route, envelope({"items": [], "summary": {"total": 0, "info": 0, "warn": 0, "critical": 0}, "total": 0, "page": 1, "limit": 20}))
        return
    if path.endswith("/proctoring/my-review-cases"):
        assert f"attemptId={ATTEMPT_ID}" in parsed.query, "成绩页必须使用 attemptId 精确查询本人案件"
        fulfill_json(
            route,
            envelope({"items": [candidate_list_item(current_case)], "total": 1, "page": 1, "limit": 1}),
        )
        return
    if path.endswith(f"/proctoring/my-review-cases/{CASE_ID}"):
        fulfill_json(route, envelope(copy.deepcopy(current_case)))
        return
    if path.endswith(f"/proctoring/my-review-cases/{CASE_ID}/responses"):
        payload = request.post_data_json
        response_payloads.append(payload)
        if len(response_payloads) == 1:
            version_conflict_seen = True
            current_case["version"] = 3
            current_case["updatedAt"] = iso(now - timedelta(minutes=10))
            current_case["messages"].append(
                {
                    "messageId": SECOND_MESSAGE_ID,
                    "messageType": "information_request",
                    "replyToMessageId": None,
                    "body": "请同时说明新的设备切换记录。",
                    "createdAt": iso(now - timedelta(minutes=10)),
                }
            )
            fulfill_json(
                route,
                failure("PROCTORING_REVIEW_VERSION_CONFLICT", 409, "案件已被其他考务人员更新"),
            )
            return
        assert payload["expectedVersion"] == 3, "冲突后必须使用刷新得到的最新版本"
        assert payload["replyToMessageId"] == SECOND_MESSAGE_ID, "冲突后必须回应最新问题"
        current_case["status"] = "pending_review"
        current_case["version"] = 4
        current_case["updatedAt"] = iso(now)
        current_case["messages"].append(
            {
                "messageId": payload["messageId"],
                "messageType": "candidate_response",
                "replyToMessageId": payload["replyToMessageId"],
                "body": payload["body"],
                "createdAt": iso(now),
            }
        )
        fulfill_json(route, envelope({"case": copy.deepcopy(current_case), "replayed": False}, "补充说明已提交"))
        return
    if path.endswith(f"/proctoring/my-review-cases/{CASE_ID}/appeals"):
        payload = request.post_data_json
        appeal_payloads.append(payload)
        if len(appeal_payloads) == 1:
            fulfill_json(route, failure("SERVICE_UNAVAILABLE", 503, "模拟网络抖动，请重试"))
            return
        assert payload["appealId"] == appeal_payloads[0]["appealId"], "网络不确定重试必须复用同一申诉 UUID"
        assert payload == appeal_payloads[0], "网络不确定重试必须保持请求语义不变"
        current_case["status"] = "appeal_pending"
        current_case["version"] = 6
        current_case["updatedAt"] = iso(now)
        current_case["appeal"] = {
            "appealId": payload["appealId"],
            "reasonCode": payload["reasonCode"],
            "statement": payload["statement"],
            "status": "pending",
            "submittedAt": iso(now),
            "resolvedAt": None,
        }
        fulfill_json(route, envelope({"case": copy.deepcopy(current_case), "replayed": False}, "申诉已提交"))
        return

    fulfill_json(route, envelope({}))


def assert_no_horizontal_overflow(page, label: str):
    dimensions = page.evaluate(
        "({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })"
    )
    assert dimensions["scrollWidth"] <= dimensions["innerWidth"], f"{label}存在横向溢出：{dimensions}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 393, "height": 852},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    context.add_init_script(
        "window.Capacitor = {"
        "  PluginHeaders: [{ name: 'WenhengSecureSession', methods: ["
        "    { name: 'read', rtype: 'promise' },"
        "    { name: 'write', rtype: 'promise' },"
        "    { name: 'clear', rtype: 'promise' }"
        "  ] }],"
        "  nativePromise: async (pluginName, methodName) => {"
        "    if (pluginName !== 'WenhengSecureSession') return {};"
        f"    if (methodName === 'read') return {{ session: {{ accessToken: {json.dumps(token)}, mode: 'session', expiresAt: null }} }};"
        "    return {};"
        "  }"
        "};"
        f"sessionStorage.setItem('token', {json.dumps(token)});"
        "sessionStorage.setItem('userRole', 'student');"
        "localStorage.setItem('userRole', 'student');"
        "localStorage.setItem('auth_storage', 'session');"
    )
    page = context.new_page()
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.route("**/api/**", handle_api)

    page.goto(f"{BASE_URL}/results/501")
    try:
        page.get_by_role("heading", name="问衡产品能力测评").wait_for()
    except PlaywrightTimeoutError as error:
        debug_screenshot = "/tmp/wenheng-mobile-proctoring-review-phase5-debug.png"
        page.screenshot(path=debug_screenshot, full_page=True)
        body_text = page.locator("body").inner_text()[:2000]
        raise AssertionError(
            f"结果页未就绪；url={page.url!r} title={page.title()!r} body={body_text!r} screenshot={debug_screenshot}"
        ) from error
    page.get_by_text("88 / 100", exact=True).wait_for()
    page.get_by_text("成绩轨道", exact=True).wait_for()
    page.get_by_text("复核轨道", exact=True).wait_for()
    page.get_by_text("成绩与监考复核相互独立", exact=True).wait_for()
    assert_no_horizontal_overflow(page, "结果页")
    page.screenshot(path=str(SCREENSHOT), full_page=True)

    page.get_by_role("button", name="补充说明").click()
    page.wait_for_url(f"**/proctoring/reviews/{CASE_ID}")
    page.get_by_role("heading", name="监考复核进度").wait_for()
    assert_no_horizontal_overflow(page, "复核详情页")

    page.get_by_role("button", name="补充说明").click()
    page.get_by_label("情况说明").fill("考试期间系统切换了前后摄像头，网络未中断。")
    page.get_by_role("button", name="确认提交").click()
    page.get_by_text("案件状态已更新，已加载最新内容，请确认后重新操作。").wait_for()
    assert len([item for item in current_case["messages"] if item["messageType"] == "candidate_response"]) == 0
    page.locator(".ant-modal:visible").get_by_text("请同时说明新的设备切换记录。", exact=True).wait_for()
    page.get_by_role("button", name="确认提交").click()
    page.get_by_text("补充说明已提交。").wait_for()
    assert len([item for item in current_case["messages"] if item["messageType"] == "candidate_response"]) == 1

    current_case["status"] = "decided"
    current_case["outcome"] = "violation_confirmed"
    current_case["version"] = 5
    current_case["firstDecidedAt"] = iso(now)
    current_case["appealDeadlineAt"] = iso(appeal_deadline)
    current_case["closedAt"] = None
    current_case["updatedAt"] = iso(now)
    current_case["decisions"].append(
        {
            "action": "confirm_violation",
            "reasonCode": "MULTIPLE_PERSONS_CONFIRMED",
            "createdAt": iso(now),
        }
    )
    page.reload()
    page.get_by_role("button", name="提交申诉").wait_for()
    page.get_by_role("button", name="提交申诉").click()
    page.get_by_label("原因").click()
    page.get_by_text("环境原因", exact=True).click()
    page.get_by_label("申诉说明").fill("家人在门口短暂停留，并未参与作答。")
    page.get_by_role("button", name="确认申诉").click()
    page.get_by_text("模拟网络抖动，请重试").wait_for()
    page.get_by_role("button", name="确认申诉").click()
    page.get_by_text("申诉已提交，考务人员将进行复核。").wait_for()
    page.locator(".ant-modal").wait_for(state="hidden")
    page.get_by_role("button", name="申诉处理中").wait_for()
    page.wait_for_function("document.querySelectorAll('.ant-message-notice').length === 0")
    assert_no_horizontal_overflow(page, "申诉提交后详情页")
    page.evaluate("window.scrollTo(0, 0)")
    page.screenshot(path=str(APPEAL_SCREENSHOT), full_page=True)

    assert version_conflict_seen, "必须覆盖一次乐观锁版本冲突"
    assert len(response_payloads) == 2, "版本冲突后应由用户确认并提交一次最新回复"
    assert len(appeal_payloads) == 2, "网络不确定场景应进行一次手动重试"
    assert len({payload["appealId"] for payload in appeal_payloads}) == 1, "手动重试不能生成第二个申诉 UUID"
    assert console_errors == [], f"浏览器控制台存在错误：{console_errors}"
    browser.close()

print(
    json.dumps(
        {
            "ok": True,
            "viewport": "393x852",
            "screenshot": str(SCREENSHOT),
            "appealScreenshot": str(APPEAL_SCREENSHOT),
            "versionConflictSeen": version_conflict_seen,
            "responseRequests": len(response_payloads),
            "appealRequests": len(appeal_payloads),
            "uniqueAppealIds": len({payload["appealId"] for payload in appeal_payloads}),
            "consoleErrors": console_errors,
        },
        ensure_ascii=False,
    )
)
