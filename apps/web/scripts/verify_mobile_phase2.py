import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:4173"
SCREENSHOT = Path("/tmp/wenheng-mobile-register-phase2.png")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(
        viewport={"width": 393, "height": 852},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    console_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    page.goto(f"{BASE_URL}/register")
    page.wait_for_load_state("networkidle")
    try:
        page.get_by_text("账号与数据所在地区", exact=True).wait_for()
    except Exception as error:
        page.screenshot(path="/tmp/wenheng-mobile-register-diagnostic.png", full_page=True)
        body = page.locator("body").inner_text()
        raise AssertionError(
            f"注册页未出现地区字段；url={page.url}; body={body[:2000]}; console={console_errors}"
        ) from error
    page.get_by_text("海外地区", exact=True).click()
    country_input = page.get_by_label("常住国家或地区代码")
    assert country_input.is_enabled(), "海外注册的国家或地区代码输入框应可用"
    country_input.fill("US")
    assert page.locator('input[type="date"]').count() == 1, "注册页必须包含出生日期输入"

    terms = page.get_by_role("link", name="用户协议")
    privacy = page.get_by_role("link", name="隐私政策")
    assert terms.get_attribute("href") == "/legal/terms"
    assert privacy.get_attribute("href") == "/legal/privacy"
    privacy.scroll_into_view_if_needed()
    assert privacy.is_visible(), "手机视口必须能滚动到隐私政策链接"
    submit_button = page.locator('button[type="submit"]')
    assert submit_button.count() == 1, "注册页必须有且仅有一个提交按钮"
    submit_button.scroll_into_view_if_needed()
    assert submit_button.is_visible(), "手机视口必须能滚动到注册按钮"
    page.screenshot(path=str(SCREENSHOT), full_page=True)

    page.goto(f"{BASE_URL}/account-deletion")
    page.wait_for_load_state("networkidle")
    page.get_by_role("heading", name="账号注销状态").wait_for()
    page.get_by_text("此页面不会保存密码", exact=False).wait_for()

    browser.close()

print(json.dumps({
    "ok": True,
    "screenshot": str(SCREENSHOT),
    "consoleErrors": console_errors,
}, ensure_ascii=False))
