
"""
FastAPI backend — bridges the React frontend to Azure Voice Live.

Endpoints:
  GET  /api/orders/{order_id}  -> look_up_order
  POST /api/refund            -> start_refund
  POST /api/escalate          -> escalate_to_human
  WS   /ws/voice              -> audio proxy to Azure Voice Live
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict
from urllib.parse import quote

import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from order_store import (
    ORDER_STORE_LOCK,
    OrderStoreError,
    calculate_expected_refund_date,
    calculate_remaining_working_days,
    dashboard_summary,
    find_order,
    is_refund_overdue,
    list_refunds,
    read_orders,
    update_order,
)


# ---------------------------------------------------------------------------
# ENVIRONMENT AND LOGGING
# ---------------------------------------------------------------------------

load_dotenv()

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("server")

app = FastAPI(title="Maya Support API")


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *[
            origin.strip()
            for origin in os.environ.get("FRONTEND_ORIGINS", "").split(",")
            if origin.strip()
        ],
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# BUSINESS LOGIC
# ---------------------------------------------------------------------------

def look_up_order(order_id: str) -> Dict[str, Any]:
    """Look up order information."""

    order_id = order_id.strip().upper()

    order = find_order(order_id)

    if not order:
        return {
            "found": False,
            "message": f"No order found with ID {order_id}.",
        }

    eta = (
        datetime.now() + timedelta(days=order["eta_days"])
    ).strftime("%B %d")

    result = {
        "found": True,
        "order_id": order_id,
        "item": order["item"],
        "status": order["status"],
        "carrier": order["carrier"],
        "estimated_delivery": (
            eta
            if order["status"] != "delivered"
            else "Already delivered"
        ),
        "total_inr": order["total"],
    }
    for field in (
        "refund_status",
        "refund_reason",
        "refund_ticket_id",
        "refund_amount_inr",
        "refund_requested_at",
        "refund_issued_date",
        "expected_refund_date",
        "complaint_ticket_id",
        "complaint_status",
        "remaining_working_days",
        "overdue",
    ):
        if field in order:
            result[field] = order[field]
    result["remaining_working_days"] = calculate_remaining_working_days(
        order.get("expected_refund_date")
    )
    result["overdue"] = is_refund_overdue(
        order.get("refund_status"),
        order.get("expected_refund_date"),
    )
    for field in (
        "complaint_refund_ticket_id",
        "complaint_amount_inr",
        "complaint_reason",
        "complaint_created_date",
    ):
        if field in order:
            result[field] = order[field]
    return result


def start_refund(order_id: str, reason: str) -> Dict[str, Any]:
    """Start a refund request."""

    order_id = order_id.strip().upper()

    order = find_order(order_id)

    if not order:
        return {
            "success": False,
            "message": f"Order {order_id} does not exist.",
        }

    if order["status"] == "processing":
        return {
            "success": False,
            "message": (
                "This order hasn't shipped yet. "
                "It can be cancelled instead of refunded."
            ),
        }

    with ORDER_STORE_LOCK:
        order = find_order(order_id)
        if order and order.get("refund_status") in {"requested", "pending", "completed"}:
            return {
                "success": False,
                "duplicate": True,
                "message": (
                    f"A refund has already been requested for order {order_id}. "
                    f"The ticket is {order.get('refund_ticket_id')}."
                ),
                "order_id": order_id,
                "ticket_id": order.get("refund_ticket_id"),
                "refund_status": order.get("refund_status"),
            }

        requested_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        refund_issued_date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        ticket_id = f"RF-{order_id}-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        expected_refund_date = calculate_expected_refund_date(
            refund_issued_date,
            7,
        )
        try:
            updated_order = update_order(
                order_id,
                {
                    "refund_status": "pending",
                    "refund_reason": reason.strip(),
                    "refund_amount_inr": order["total"],
                    "refund_ticket_id": ticket_id,
                    "refund_requested_at": requested_at,
                    "refund_issued_date": refund_issued_date,
                    "expected_refund_date": expected_refund_date,
                    "complaint_ticket_id": None,
                    "complaint_status": None,
                    "processing_days": 5,
                },
            )
        except (KeyError, OrderStoreError):
            logger.exception("Could not persist refund for order %s", order_id)
            return {
                "success": False,
                "message": "The refund could not be saved. Please try again.",
            }

    return {
        "success": True,
        "order_id": order_id,
        "reason": updated_order["refund_reason"],
        "refund_amount_inr": order["total"],
        "processing_days": 5,
        "ticket_id": ticket_id,
        "refund_status": "pending",
        "requested_at": requested_at,
        "refund_issued_date": refund_issued_date,
        "expected_refund_date": expected_refund_date,
        "order": look_up_order(order_id),
    }


def get_refund_timeline(order_id: str) -> Dict[str, Any]:
    """Return the refund issue date, expected date, remaining working days, and complaint status."""
    order_id = order_id.strip().upper()
    order = find_order(order_id)

    if not order:
        return {
            "found": False,
            "message": f"No order found with ID {order_id}.",
        }

    refund_status = str(order.get("refund_status") or "").lower()
    if not refund_status:
        return {
            "found": True,
            "order_id": order_id,
            "refund_status": "not_requested",
            "message": "No refund request exists for this order.",
        }

    issued_date = order.get("refund_issued_date") or order.get("refund_requested_at")
    expected_date = order.get("expected_refund_date") or calculate_expected_refund_date(issued_date or datetime.utcnow(), 7)
    complaint_ticket = order.get("complaint_ticket_id")
    complaint_status = order.get("complaint_status") or "None"

    return {
        "found": True,
        "order_id": order_id,
        "refund_status": refund_status,
        "refund_issued_date": issued_date,
        "expected_refund_date": expected_date,
        "remaining_working_days": calculate_remaining_working_days(expected_date),
        "overdue": is_refund_overdue(refund_status, expected_date),
        "complaint_ticket_id": complaint_ticket,
        "complaint_status": complaint_status,
        "complaint_refund_ticket_id": order.get("complaint_refund_ticket_id"),
        "complaint_amount_inr": order.get("complaint_amount_inr"),
        "complaint_reason": order.get("complaint_reason"),
        "complaint_created_date": order.get("complaint_created_date"),
    }


def escalate_to_human(summary: str) -> Dict[str, Any]:
    """Escalate the conversation to a human agent."""

    logger.info("ESCALATION: %s", summary)

    return {
        "queued": True,
        "ticket_id": (
            f"ESC-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        ),
        "wait_minutes": 4,
        "message": "A human agent will join shortly.",
    }


# ---------------------------------------------------------------------------
# REST API ENDPOINTS
# ---------------------------------------------------------------------------

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str):
    result = look_up_order(order_id)

    if not result.get("found"):
        raise HTTPException(
            status_code=404,
            detail=result["message"],
        )

    return result


class RefundRequest(BaseModel):
    order_id: str = Field(min_length=1)
    reason: str = Field(min_length=1)


@app.post("/api/refund")
async def post_refund(body: RefundRequest):
    result = start_refund(
        body.order_id,
        body.reason,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=409 if result.get("duplicate") else 400,
            detail=result["message"],
        )

    return result


@app.get("/api/refunds")
async def get_refunds():
    return {"refunds": list_refunds()}


@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    return dashboard_summary()


class EscalateRequest(BaseModel):
    summary: str = Field(min_length=1)


@app.post("/api/escalate")
async def post_escalate(body: EscalateRequest):
    return escalate_to_human(body.summary)


# ---------------------------------------------------------------------------
# AZURE VOICE LIVE CONFIGURATION
# ---------------------------------------------------------------------------

AZURE_ENDPOINT = os.environ.get(
    "AZURE_VOICELIVE_ENDPOINT",
    "",
).rstrip("/")

AZURE_API_KEY = os.environ.get(
    "AZURE_VOICELIVE_API_KEY",
    "",
)

AZURE_MODEL = os.environ.get(
    "AZURE_VOICELIVE_MODEL",
    "gpt-realtime",
)

AZURE_VOICE = os.environ.get(
    "AZURE_VOICELIVE_VOICE",
    "en-US-Ava:DragonHDLatestNeural",
)
VOICE_DEBUG = os.environ.get(
    "VOICE_DEBUG",
    "false",
).lower() in {"1", "true", "yes", "on"}


def log_debug(message: str, *args: Any) -> None:
    if VOICE_DEBUG:
        logger.info("[DEBUG] %s", message % args if args else message)


def _safe_event_type(event: Any) -> str:
    return event.get("type", "") if isinstance(event, dict) else ""


INSTRUCTIONS = """
You are Maya, a phone support agent for an online electronics store.

How to speak:
- Keep every answer to one or two short sentences.
- This is a phone call, not a chat.
- Say numbers naturally.
- Do not read JSON, field names, or ticket IDs character by character.
- Before using a tool, say a short filler such as:
  "Let me check that for you."

How to help:
- Collect the order ID before looking anything up.
- Read the order ID back to confirm it.
- Only state facts returned by a tool.
- Never guess a delivery date, price, or order status.
- If a tool says something is not possible, explain the alternative.
- If the customer is frustrated or asks for a person, escalate politely.

Open the call by greeting the customer and asking how you can help.
""".strip()


# ---------------------------------------------------------------------------
# TOOL DEFINITIONS
# ---------------------------------------------------------------------------

TOOLS_SCHEMA = [
    {
        "type": "function",
        "name": "look_up_order",
        "description": (
            "Look up the status, carrier, and delivery estimate "
            "for a customer's order."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID, for example A1001.",
                },
            },
            "required": ["order_id"],
        },
    },
    {
        "type": "function",
        "name": "start_refund",
        "description": (
            "Open a refund request for an order "
            "the customer is unhappy with."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID.",
                },
                "reason": {
                    "type": "string",
                    "description": "Reason for requesting a refund.",
                },
            },
            "required": ["order_id", "reason"],
        },
    },
    {
        "type": "function",
        "name": "get_refund_timeline",
        "description": (
            "Return the refund issue date, expected completion date, remaining working days, and complaint ticket status for an order. Use this when the customer asks when the refund will reach their bank account or whether a complaint has been raised."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID for the refund being tracked.",
                },
            },
            "required": ["order_id"],
        },
    },
    {
        "type": "function",
        "name": "escalate_to_human",
        "description": (
            "Transfer the customer to a human agent."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": (
                        "Short summary of the customer's issue."
                    ),
                },
            },
            "required": ["summary"],
        },
    },
]


AVAILABLE_FUNCTIONS = {
    "look_up_order": lambda args: look_up_order(
        args.get("order_id", "")
    ),
    "start_refund": lambda args: start_refund(
        args.get("order_id", ""),
        args.get("reason", ""),
    ),
    "get_refund_timeline": lambda args: get_refund_timeline(
        args.get("order_id", "")
    ),
    "escalate_to_human": lambda args: escalate_to_human(
        args.get("summary", "")
    ),
}


# ---------------------------------------------------------------------------
# AZURE WEBSOCKET URL
# ---------------------------------------------------------------------------

def _build_azure_ws_url() -> str:
    """
    Build the Azure Voice Live WebSocket URL.

    AZURE_ENDPOINT should contain only the base resource endpoint, e.g.:

    https://your-resource.cognitiveservices.azure.com
    """

    base = AZURE_ENDPOINT.strip()

    base = base.replace("https://", "")
    base = base.replace("http://", "")
    base = base.rstrip("/")

    encoded_model = quote(
        AZURE_MODEL,
        safe="",
    )

    return (
        f"wss://{base}/voice-live/realtime"
        f"?api-version=2026-04-10"
        f"&model={encoded_model}"
    )


# ---------------------------------------------------------------------------
# AZURE SESSION CONFIGURATION
# ---------------------------------------------------------------------------

def _build_session_config() -> Dict[str, Any]:
    """
    Create the Voice Live session.update payload.
    """

    return {
        "type": "session.update",
        "session": {
            "modalities": [
                "text",
                "audio",
            ],

            "instructions": INSTRUCTIONS,

            "voice": {
                "name": AZURE_VOICE,
            },

            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_sampling_rate": 24000,

            "turn_detection": {
                "type": "azure_semantic_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 400,
                "silence_duration_ms": 500,
            },

            "input_audio_transcription": {
                "model": "whisper-1",
            },

            "tools": TOOLS_SCHEMA,
            "tool_choice": "auto",
        },
    }


# ---------------------------------------------------------------------------
# TOOL EXECUTION
# ---------------------------------------------------------------------------

async def _execute_tool(
    call: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Execute a tool requested by the model.
    """

    name = call.get("name", "")

    func = AVAILABLE_FUNCTIONS.get(name)

    if not func:
        return {
            "error": f"Unknown tool: {name}",
        }

    raw_arguments = call.get("arguments", "")

    try:
        args = (
            json.loads(raw_arguments)
            if raw_arguments
            else {}
        )

        result = func(args)

        logger.info(
            "[tool] %s(%s) -> %s",
            name,
            args,
            result,
        )

        return {
            "args": args,
            "result": result,
        }

    except json.JSONDecodeError as exc:
        logger.exception("Invalid tool arguments")

        return {
            "error": f"Invalid tool arguments: {exc}",
        }

    except Exception as exc:
        logger.exception("Tool execution failed")

        return {
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# WEBSOCKET VOICE PROXY
# ---------------------------------------------------------------------------

@app.websocket("/ws/voice")
async def voice_proxy(browser_ws: WebSocket):
    """
    Browser <-> FastAPI <-> Azure Voice Live.
    """

    await browser_ws.accept()

    logger.info("Browser WebSocket connected")

    if not AZURE_ENDPOINT:
        await browser_ws.send_json({
            "type": "error",
            "message": (
                "AZURE_VOICELIVE_ENDPOINT is not configured."
            ),
        })

        await browser_ws.close()
        return

    if not AZURE_API_KEY:
        await browser_ws.send_json({
            "type": "error",
            "message": (
                "AZURE_VOICELIVE_API_KEY is not configured."
            ),
        })

        await browser_ws.close()
        return

    azure_url = _build_azure_ws_url()

    headers = {
        "api-key": AZURE_API_KEY,
    }

    logger.info(
        "Connecting to Azure Voice Live: %s",
        azure_url.replace(AZURE_MODEL, "<model>"),
    )

    async with aiohttp.ClientSession() as session:
        try:
            async with session.ws_connect(
                azure_url,
                headers=headers,
                heartbeat=30,
                timeout=aiohttp.ClientTimeout(total=None),
            ) as azure_ws:

                logger.info(
                    "Connected to Azure Voice Live successfully"
                )

                session_config = _build_session_config()

                logger.info(
                    "Sending session configuration to Azure"
                )

                await azure_ws.send_json(session_config)

                async def browser_to_azure():
                    """
                    Forward browser messages to Azure.
                    """

                    try:
                        async for message in browser_ws.iter_json():
                            event_type = _safe_event_type(message)
                            if event_type:
                                log_debug("[Browser → Azure] %s", event_type)
                            if event_type == "input_audio_buffer.append":
                                audio = message.get("audio", "")
                                if not isinstance(audio, str) or not audio:
                                    logger.warning(
                                        "Ignoring empty browser audio append"
                                    )
                                    continue
                                log_debug(
                                    "Forwarding audio append: base64_chars=%d",
                                    len(audio),
                                )
                            await azure_ws.send_json(message)

                    except WebSocketDisconnect:
                        logger.info(
                            "Browser disconnected"
                        )

                    except aiohttp.ClientConnectionError as exc:
                        logger.error(
                            "Azure connection closed: %s",
                            exc,
                        )

                    except Exception as exc:
                        logger.exception(
                            "Browser-to-Azure error: %s",
                            exc,
                        )

                async def azure_to_browser():
                    """
                    Receive Azure events, execute tools,
                    and forward events to the browser.
                    """

                    pending: Dict[str, Dict[str, Any]] = {}
                    greeting_sent = False

                    try:
                        async for message in azure_ws:

                            if message.type == aiohttp.WSMsgType.TEXT:
                                try:
                                    event = json.loads(
                                        message.data
                                    )

                                except json.JSONDecodeError:
                                    logger.error(
                                        "Invalid JSON from Azure: %s",
                                        message.data,
                                    )
                                    continue

                                event_type = event.get(
                                    "type",
                                    "",
                                )

                                log_debug("[Azure → Browser] %s", event_type)

                                if event_type == "session.updated" and not greeting_sent:
                                    greeting_sent = True
                                    logger.info("Azure session ready; triggering initial greeting")
                                    await azure_ws.send_json({"type": "response.create"})

                                if event_type == "error":
                                    error = event.get("error", {})
                                    error_message = (
                                        error.get("message", "Unknown Azure error")
                                        if isinstance(error, dict)
                                        else str(error)
                                    )
                                    logger.error("Azure error: %s", error_message)

                                if event_type == (
                                    "conversation.item.created"
                                ):
                                    item = event.get(
                                        "item",
                                        {},
                                    )

                                    if item.get("type") == (
                                        "function_call"
                                    ):
                                        call_id = item.get(
                                            "call_id"
                                        )

                                        pending[call_id] = {
                                            "name": item.get(
                                                "name",
                                                "",
                                            ),
                                            "call_id": call_id,
                                            "item_id": item.get(
                                                "id"
                                            ),
                                            "arguments": "",
                                        }

                                elif event_type == (
                                    "response.function_call_arguments.delta"
                                ):
                                    call_id = event.get(
                                        "call_id"
                                    )

                                    if call_id in pending:
                                        pending[call_id][
                                            "arguments"
                                        ] += event.get(
                                            "delta",
                                            "",
                                        )

                                elif event_type == (
                                    "response.function_call_arguments.done"
                                ):
                                    call_id = event.get(
                                        "call_id"
                                    )

                                    if call_id in pending:
                                        pending[call_id][
                                            "arguments"
                                        ] = event.get(
                                            "arguments",
                                            pending[call_id][
                                                "arguments"
                                            ],
                                        )

                                elif event_type == "response.done":

                                    for call_id, call in list(
                                        pending.items()
                                    ):

                                        tool_output = (
                                            await _execute_tool(
                                                call
                                            )
                                        )

                                        args = tool_output.get(
                                            "args",
                                            {},
                                        )

                                        result = tool_output.get(
                                            "result",
                                            tool_output,
                                        )

                                        try:
                                            await browser_ws.send_json({
                                                "type": "tool_call",
                                                "name": call["name"],
                                                "args": args,
                                                "result": result,
                                            })

                                        except Exception:
                                            logger.exception(
                                                "Could not notify browser"
                                            )

                                        await azure_ws.send_json({
                                            "type": (
                                                "conversation.item.create"
                                            ),
                                            "item": {
                                                "type": (
                                                    "function_call_output"
                                                ),
                                                "call_id": (
                                                    call["call_id"]
                                                ),
                                                "output": json.dumps(
                                                    result
                                                ),
                                            },
                                        })

                                        await azure_ws.send_json({
                                            "type": "response.create",
                                        })

                                        del pending[call_id]

                                try:
                                    await browser_ws.send_json(
                                        event
                                    )

                                except Exception:
                                    logger.exception(
                                        "Could not forward Azure event"
                                    )
                                    return

                            elif message.type == (
                                aiohttp.WSMsgType.ERROR
                            ):
                                logger.error(
                                    "Azure WebSocket error: %s",
                                    azure_ws.exception(),
                                )
                                return

                            elif message.type in (
                                aiohttp.WSMsgType.CLOSED,
                                aiohttp.WSMsgType.CLOSING,
                            ):
                                logger.info(
                                    "Azure WebSocket closed"
                                )
                                return

                    except WebSocketDisconnect:
                        logger.info(
                            "Browser WebSocket disconnected"
                        )

                    except aiohttp.ClientConnectionError as exc:
                        logger.exception(
                            "Azure connection error: %s",
                            exc,
                        )

                    except Exception as exc:
                        logger.exception(
                            "Unexpected Azure event error: %s",
                            exc,
                        )

                        try:
                            await browser_ws.send_json({
                                "type": "error",
                                "message": (
                                    f"Azure event error: {exc}"
                                ),
                            })

                        except Exception:
                            pass

                tasks = [
                    asyncio.create_task(browser_to_azure()),
                    asyncio.create_task(azure_to_browser()),
                ]
                done, pending_tasks = await asyncio.wait(
                    tasks,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending_tasks:
                    task.cancel()
                await asyncio.gather(*pending_tasks, return_exceptions=True)
                for task in done:
                    exception = task.exception()
                    if exception and not isinstance(exception, asyncio.CancelledError):
                        logger.error("Voice proxy task ended: %s", exception)

        except asyncio.CancelledError:
            logger.info("Voice proxy cancelled during shutdown")
            raise

        except aiohttp.WSServerHandshakeError as exc:
            logger.exception(
                "Azure WebSocket handshake failed"
            )

            try:
                await browser_ws.send_json({
                    "type": "error",
                    "message": (
                        f"Azure WebSocket handshake failed "
                        f"with status {exc.status}."
                    ),
                })

            except Exception:
                pass

        except aiohttp.ClientConnectorError as exc:
            logger.exception(
                "Cannot connect to Azure"
            )

            try:
                await browser_ws.send_json({
                    "type": "error",
                    "message": (
                        f"Cannot reach Azure: {exc}"
                    ),
                })

            except Exception:
                pass

        except aiohttp.ClientError as exc:
            logger.exception(
                "Azure client error"
            )

            try:
                await browser_ws.send_json({
                    "type": "error",
                    "message": (
                        f"Azure client error: {exc}"
                    ),
                })

            except Exception:
                pass

        except Exception as exc:
            logger.exception(
                "Unexpected error in voice proxy"
            )

            try:
                await browser_ws.send_json({
                    "type": "error",
                    "message": (
                        f"Server error: {exc}"
                    ),
                })

            except Exception:
                pass

        finally:
            logger.info(
                "Voice proxy session ended"
            )