"""
OliveYoung Insight Slack Bot
OpenAI function calling + MCP 서버 연동

환경변수:
  SLACK_BOT_TOKEN   xoxb-...
  SLACK_APP_TOKEN   xapp-... (Socket Mode)
  OPENAI_API_KEY    sk-...
  MCP_SERVER_URL    https://oliveyoungreview.vercel.app/api/mcp (기본값)
  MCP_API_KEY       Bearer 인증 키 (없으면 생략)
"""
import os
import re
import json
import asyncio
import logging

from slack_bolt.async_app import AsyncApp
from slack_bolt.adapter.socket_mode.async_handler import AsyncSocketModeHandler
from openai import AsyncOpenAI
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MCP_URL     = os.environ.get("MCP_SERVER_URL", "https://oliveyoung-review.vercel.app/api/mcp")
MCP_API_KEY = os.environ.get("MCP_API_KEY", "")

app    = AsyncApp(token=os.environ["SLACK_BOT_TOKEN"])
openai = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

_tools_cache: list | None = None

SYSTEM = (
    "당신은 셀퓨전씨 올리브영 인사이트 어시스턴트입니다. "
    "올리브영 판매 데이터, 리뷰, 시장 순위를 분석해서 한국어로 간결하게 답변하세요. "
    "숫자는 구체적으로, 인사이트는 실무에서 바로 쓸 수 있게 답변하세요. "
    "필요한 데이터는 제공된 도구를 사용해 직접 조회하세요.\n\n"
    "데이터 해석 규칙:\n"
    "- is_ours=true 또는 is_ours=True 인 상품만 셀퓨전씨 자사 상품입니다.\n"
    "- is_ours=false 또는 is_ours=False 인 상품은 모두 경쟁사 상품입니다.\n"
    "- goods_name에 다른 브랜드명이 있으면 그것이 실제 브랜드입니다. 절대 셀퓨전씨로 표기하지 마세요.\n"
    "- 순위 조회 시 셀퓨전씨 상품이 없으면 '해당 카테고리에 자사 상품 없음'으로 답하세요.\n\n"
    "올리브영 카테고리 매핑 (사용자가 이렇게 말하면 아래 카테고리명으로 조회):\n"
    "- 선크림, 선케어, 자외선차단제, 썬 → 선케어\n"
    "- 스킨, 토너, 에센스, 세럼, 앰플, 로션, 크림 → 스킨케어\n"
    "- 클렌징, 세안 → 클렌징\n"
    "- 마스크팩, 팩 → 마스크팩\n"
    "- 바디로션, 바디크림, 바디 → 바디케어\n"
    "- 더모, 더마 → 더모 코스메틱\n"
    "- 남성, 맨즈 → 맨즈에딧\n"
    "- 전체, 전 카테고리 → 전체"
)


def _headers() -> dict:
    return {"Authorization": f"Bearer {MCP_API_KEY}"} if MCP_API_KEY else {}


async def _list_tools():
    global _tools_cache
    if _tools_cache is not None:
        return _tools_cache
    async with streamablehttp_client(MCP_URL, headers=_headers()) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            _tools_cache = (await s.list_tools()).tools
            log.info("툴 목록 캐싱 완료: %d개", len(_tools_cache))
            return _tools_cache


async def _call_tool(name: str, arguments: dict):
    async with streamablehttp_client(MCP_URL, headers=_headers()) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            return await s.call_tool(name, arguments)


def _to_openai_tool(t) -> dict:
    return {
        "type": "function",
        "function": {
            "name": t.name,
            "description": t.description or "",
            "parameters": t.inputSchema or {"type": "object", "properties": {}},
        },
    }


async def answer(user_text: str) -> str:
    try:
        tools = await _list_tools()
    except Exception as e:
        log.error("MCP 서버 연결 실패: %s", e)
        return "데이터 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."

    oai_tools = [_to_openai_tool(t) for t in tools]
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user",   "content": user_text},
    ]

    for _ in range(6):  # 최대 6라운드 tool call
        resp = await openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=oai_tools,
            tool_choice="auto",
            max_tokens=1500,
        )
        msg = resp.choices[0].message

        if not msg.tool_calls:
            return msg.content or "답변을 생성하지 못했습니다."

        messages.append(msg)

        for tc in msg.tool_calls:
            try:
                args   = json.loads(tc.function.arguments or "{}")
                result = await _call_tool(tc.function.name, args)
                content = "\n".join(
                    c.text if hasattr(c, "text") else str(c)
                    for c in result.content
                )
            except Exception as e:
                content = f"[오류: {e}]"
                log.error("툴 호출 실패 %s: %s", tc.function.name, e)

            messages.append({
                "role":         "tool",
                "tool_call_id": tc.id,
                "content":      content,
            })

    return "처리 중 오류가 발생했습니다."


# ── 이벤트 핸들러 ──────────────────────────────────────

@app.event("app_mention")
async def on_mention(event, say):
    text = re.sub(r"<@\w+>", "", event.get("text", "")).strip()
    if not text:
        await say("무엇이 궁금하신가요?", thread_ts=event["ts"])
        return
    await say(":mag: 조회 중...", thread_ts=event["ts"])
    result = await answer(text)
    await say(result, thread_ts=event["ts"])


@app.event("message")
async def on_dm(event, say):
    # DM만 처리, 봇 자신의 메시지는 무시
    if event.get("channel_type") != "im" or event.get("bot_id"):
        return
    text = event.get("text", "").strip()
    if not text:
        return
    await say(":mag: 조회 중...")
    result = await answer(text)
    await say(result)


# ── 메인 ──────────────────────────────────────────────

async def _main():
    handler = AsyncSocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    log.info("Slack 봇 시작 (Socket Mode)")
    await handler.start_async()

if __name__ == "__main__":
    asyncio.run(_main())
