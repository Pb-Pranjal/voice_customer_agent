"""
Voice Customer Support Agent - Azure AI Foundry Voice Live API

Speak into your microphone, the agent answers out loud, and it calls the
Python functions below when it needs real data (order status, refunds, etc).

Run:  python support_agent.py
Quit: Ctrl+C
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import queue
import signal
import sys
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional, Union

import pyaudio
from dotenv import load_dotenv

from azure.core.credentials import AzureKeyCredential
from azure.ai.voicelive.aio import connect
from azure.ai.voicelive.models import (
    AudioEchoCancellation,
    AudioInputTranscriptionOptions,
    AudioNoiseReduction,
    AzureStandardVoice,
    FunctionCallOutputItem,
    FunctionTool,
    InputAudioFormat,
    ItemType,
    Modality,
    OutputAudioFormat,
    RequestSession,
    ServerEventType,
    ServerVad,
    Tool,
    ToolChoiceLiteral,
)
from order_store import OrderStoreError, calculate_expected_refund_date, find_order, update_order

load_dotenv()

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("support_agent")
logger.setLevel(logging.INFO)


# ---------------------------------------------------------------------------
# 1. YOUR BUSINESS LOGIC
# ---------------------------------------------------------------------------
# These are plain Python functions. Right now they return fake data so you can
# test immediately. Later, swap the bodies for real database or API calls --
# nothing else in this file has to change.

def look_up_order(args: Dict[str, Any]) -> Dict[str, Any]:
    """Find an order by its ID."""
    order_id = str(args.get("order_id", "")).strip().upper()
    order = find_order(order_id)
    if not order:
        return {"found": False,
                "message": f"No order found with ID {order_id}."}

    eta = (datetime.now() + timedelta(days=order["eta_days"])).strftime("%B %d")
    result = {
        "found": True,
        "order_id": order_id,
        "item": order["item"],
        "status": order["status"],
        "carrier": order["carrier"],
        "estimated_delivery": eta if order["status"] != "delivered" else "already delivered",
        "total_inr": order["total"],
    }
    for field in (
        "refund_status",
        "refund_reason",
        "refund_ticket_id",
        "refund_amount_inr",
        "refund_requested_at",
    ):
        if field in order:
            result[field] = order[field]
    return result


def start_refund(args: Dict[str, Any]) -> Dict[str, Any]:
    """Open a refund request for an order."""
    order_id = str(args.get("order_id", "")).strip().upper()
    reason = args.get("reason", "not specified")
    order = find_order(order_id)

    if not order:
        return {"success": False, "message": f"Order {order_id} does not exist."}
    if order["status"] == "processing":
        return {"success": False,
                "message": "This order hasn't shipped yet, so it can be cancelled "
                           "instead of refunded. Offer to cancel it."}

    if order.get("refund_status") in {"requested", "pending", "completed"}:
        return {
            "success": False,
            "duplicate": True,
            "message": f"A refund has already been requested for {order_id}.",
            "ticket_id": order.get("refund_ticket_id"),
        }

    requested_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    issued_date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    ticket_id = f"RF-{order_id}-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    expected_refund_date = calculate_expected_refund_date(issued_date, 7)
    try:
        update_order(order_id, {
            "refund_status": "pending",
            "refund_reason": str(reason).strip(),
            "refund_amount_inr": order["total"],
            "refund_ticket_id": ticket_id,
            "refund_requested_at": requested_at,
            "refund_issued_date": issued_date,
            "expected_refund_date": expected_refund_date,
            "processing_days": 5,
        })
    except (KeyError, OrderStoreError):
        logger.exception("Could not persist refund for order %s", order_id)
        return {"success": False, "message": "The refund could not be saved."}

    return {
        "success": True,
        "order_id": order_id,
        "reason": reason,
        "refund_amount_inr": order["total"],
        "processing_days": 5,
        "ticket_id": ticket_id,
        "refund_status": "pending",
        "requested_at": requested_at,
        "refund_issued_date": issued_date,
        "expected_refund_date": expected_refund_date,
    }


def get_refund_timeline(args: Dict[str, Any]) -> Dict[str, Any]:
    """Return refund timeline details for support responses."""
    order_id = str(args.get("order_id", "")).strip().upper()
    order = find_order(order_id)
    if not order:
        return {"found": False, "message": f"No order found with ID {order_id}."}

    refund_status = str(order.get("refund_status") or "").lower()
    if not refund_status:
        return {"found": True, "order_id": order_id, "refund_status": "not_requested", "message": "No refund request exists for this order."}

    issued = order.get("refund_issued_date") or order.get("refund_requested_at")
    expected = order.get("expected_refund_date") or calculate_expected_refund_date(issued, 7)
    return {
        "found": True,
        "order_id": order_id,
        "refund_status": refund_status,
        "refund_issued_date": issued,
        "expected_refund_date": expected,
        "complaint_ticket_id": order.get("complaint_ticket_id"),
        "complaint_status": order.get("complaint_status"),
        "overdue": order.get("refund_status", "").lower() in {"requested", "pending", "processing", "overdue"} and datetime.utcnow().date() > datetime.strptime(str(expected), "%Y-%m-%d").date(),
    }


def escalate_to_human(args: Dict[str, Any]) -> Dict[str, Any]:
    """Hand the customer to a human agent."""
    summary = args.get("summary", "No summary provided")
    logger.info("ESCALATION: %s", summary)
    return {
        "queued": True,
        "ticket_id": f"ESC-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        "wait_minutes": 4,
        "message": "A human agent will join shortly.",
    }


# Maps the tool name the model uses -> the Python function to run.
AVAILABLE_FUNCTIONS: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
    "look_up_order": look_up_order,
    "start_refund": start_refund,
    "get_refund_timeline": get_refund_timeline,
    "escalate_to_human": escalate_to_human,
}


# ---------------------------------------------------------------------------
# 2. TOOL DEFINITIONS -- how you describe those functions to the model
# ---------------------------------------------------------------------------
# The 'description' text is what the model reads to decide when to call each
# tool. Write it the way you'd brief a new support hire. Vague descriptions are
# the single most common reason a voice agent "ignores" a tool.

TOOLS: list[Tool] = [
    FunctionTool(
        name="look_up_order",
        description=(
            "Look up the status, carrier and delivery estimate for a customer's "
            "order. Call this whenever the customer asks where their order is, "
            "when it will arrive, or what they bought. Requires the order ID."
        ),
        parameters={
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID, e.g. 'A1001'. Ask the customer "
                                   "for it if they haven't given it.",
                }
            },
            "required": ["order_id"],
        },
    ),
    FunctionTool(
        name="start_refund",
        description=(
            "Open a refund request for an order the customer is unhappy with. "
            "Only call this after confirming the order ID and the reason."
        ),
        parameters={
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID."},
                "reason": {
                    "type": "string",
                    "description": "Why the customer wants a refund, in a few words.",
                },
            },
            "required": ["order_id", "reason"],
        },
    ),
    FunctionTool(
        name="get_refund_timeline",
        description=(
            "Read the refund issue date, expected payment date, and complaint ticket info "
            "for an order. Use this when the customer asks when a refund will reach "
            "their bank account or if there was a complaint generated."
        ),
        parameters={
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID."},
            },
            "required": ["order_id"],
        },
    ),
    FunctionTool(
        name="escalate_to_human",
        description=(
            "Transfer the customer to a human agent. Call this when the customer "
            "asks for a person, is angry, or raises something outside orders and "
            "refunds -- billing disputes, legal issues, account security."
        ),
        parameters={
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "One or two sentences summarising the issue so "
                                   "the human agent doesn't have to start over.",
                }
            },
            "required": ["summary"],
        },
    ),
]


# ---------------------------------------------------------------------------
# 3. THE AGENT'S PERSONALITY
# ---------------------------------------------------------------------------
# Spoken responses need different instructions than chat. Long paragraphs sound
# terrible out loud, and the customer can't scroll back.

INSTRUCTIONS = """
You are Maya, a phone support agent for an online electronics store.

How to speak:
- Keep every answer to one or two short sentences. This is a phone call, not a chat.
- Say numbers the way a person would: "twenty four ninety nine rupees", not "2499".
- Never read out JSON, field names, or ticket IDs character by character unless asked.
- If you are about to look something up, say a short filler first like
  "Let me check that for you" so the customer isn't left in silence.

How to help:
- Collect the order ID before looking anything up. Read it back to confirm.
- Only state facts that came back from a tool. Never guess a delivery date,
  a price, or a status.
- If a tool says something is not possible, explain the alternative it suggests.
- If the customer is frustrated or asks for a person, escalate without arguing.

Open the call by greeting the customer and asking how you can help.
""".strip()


# ---------------------------------------------------------------------------
# 4. AUDIO -- microphone in, speaker out
# ---------------------------------------------------------------------------
# Voice Live expects raw PCM16 audio at 24 kHz, mono. PyAudio gives us exactly
# that. You shouldn't need to touch this section.

class AudioProcessor:
    def __init__(self, connection):
        self.connection = connection
        self.audio = pyaudio.PyAudio()
        self.format = pyaudio.paInt16
        self.channels = 1
        self.rate = 24000
        self.chunk_size = 1200  # 50 ms
        self.input_stream: Optional[pyaudio.Stream] = None
        self.output_stream: Optional[pyaudio.Stream] = None
        self.playback_queue: "queue.Queue[Optional[bytes]]" = queue.Queue()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def start_capture(self) -> None:
        if self.input_stream:
            return
        self.loop = asyncio.get_event_loop()

        def _callback(in_data, _frames, _time_info, _status):
            encoded = base64.b64encode(in_data).decode("utf-8")
            asyncio.run_coroutine_threadsafe(
                self.connection.input_audio_buffer.append(audio=encoded),
                self.loop,
            )
            return (None, pyaudio.paContinue)

        self.input_stream = self.audio.open(
            format=self.format, channels=self.channels, rate=self.rate,
            input=True, frames_per_buffer=self.chunk_size,
            stream_callback=_callback,
        )

    def start_playback(self) -> None:
        if self.output_stream:
            return
        remaining = b""

        def _callback(_in_data, frame_count, _time_info, _status):
            nonlocal remaining
            wanted = frame_count * pyaudio.get_sample_size(pyaudio.paInt16)
            out = remaining[:wanted]
            remaining = remaining[wanted:]
            while len(out) < wanted:
                try:
                    chunk = self.playback_queue.get_nowait()
                except queue.Empty:
                    out += bytes(wanted - len(out))
                    break
                if chunk is None:
                    break
                take = wanted - len(out)
                out += chunk[:take]
                remaining = chunk[take:]
            return (out, pyaudio.paContinue)

        self.output_stream = self.audio.open(
            format=self.format, channels=self.channels, rate=self.rate,
            output=True, frames_per_buffer=self.chunk_size,
            stream_callback=_callback,
        )

    def queue_audio(self, data: Optional[bytes]) -> None:
        self.playback_queue.put(data)

    def clear_playback(self) -> None:
        """Called when the customer interrupts -- stop talking immediately."""
        while not self.playback_queue.empty():
            try:
                self.playback_queue.get_nowait()
            except queue.Empty:
                break

    def shutdown(self) -> None:
        for stream in (self.input_stream, self.output_stream):
            if stream:
                stream.stop_stream()
                stream.close()
        self.input_stream = self.output_stream = None
        self.audio.terminate()


# ---------------------------------------------------------------------------
# 5. THE SESSION LOOP
# ---------------------------------------------------------------------------

class SupportAgent:
    def __init__(self, endpoint: str, credential, model: str, voice: str):
        self.endpoint = endpoint
        self.credential = credential
        self.model = model
        self.voice = voice
        self.connection = None
        self.audio: Optional[AudioProcessor] = None
        self.greeted = False
        self.active_response = False
        self.pending_call: Optional[Dict[str, Any]] = None

    async def run(self) -> None:
        print(f"Connecting to {self.endpoint} ...")
        async with connect(
            endpoint=self.endpoint,
            credential=self.credential,
            model=self.model,
        ) as connection:
            self.connection = connection
            self.audio = AudioProcessor(connection)

            await self._configure_session()
            self.audio.start_playback()

            print("\n" + "=" * 62)
            print("  VOICE SUPPORT AGENT READY -- start talking")
            print("  Try:  'Hi, where is my order A1001?'")
            print("        'I want a refund for A1003, it arrived broken.'")
            print("        'Can I speak to a human?'")
            print("  Ctrl+C to hang up")
            print("=" * 62 + "\n")

            try:
                async for event in connection:
                    await self._handle(event)
            finally:
                self.audio.shutdown()

    async def _configure_session(self) -> None:
        session = RequestSession(
            modalities=[Modality.TEXT, Modality.AUDIO],
            instructions=INSTRUCTIONS,
            voice=AzureStandardVoice(name=self.voice),
            input_audio_format=InputAudioFormat.PCM16,
            output_audio_format=OutputAudioFormat.PCM16,
            # Decides when the customer has finished speaking.
            turn_detection=ServerVad(
                threshold=0.5,
                prefix_padding_ms=400,
                silence_duration_ms=500,
            ),
            # Stops the mic picking up the agent's own voice from your speakers.
            input_audio_echo_cancellation=AudioEchoCancellation(),
            input_audio_noise_reduction=AudioNoiseReduction(
                type="azure_deep_noise_suppression"
            ),
            input_audio_transcription=AudioInputTranscriptionOptions(
                model="whisper-1"
            ),
            tools=TOOLS,
            tool_choice=ToolChoiceLiteral.AUTO,
        )
        await self.connection.session.update(session=session)

    async def _handle(self, event) -> None:
        conn, audio = self.connection, self.audio

        if event.type == ServerEventType.SESSION_UPDATED:
            audio.start_capture()
            if not self.greeted:
                self.greeted = True
                await conn.response.create()  # agent speaks first

        elif event.type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
            # Barge-in: customer started talking over the agent.
            print("[listening]")
            audio.clear_playback()
            if self.active_response:
                try:
                    await conn.response.cancel()
                except Exception:
                    pass

        elif event.type == ServerEventType.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
            print(f"Customer: {event.transcript}")

        elif event.type == ServerEventType.RESPONSE_CREATED:
            self.active_response = True

        elif event.type == ServerEventType.RESPONSE_AUDIO_DELTA:
            audio.queue_audio(event.delta)

        elif event.type == ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DONE:
            print(f"Maya: {event.transcript}")

        elif event.type == ServerEventType.CONVERSATION_ITEM_CREATED:
            if event.item.type == ItemType.FUNCTION_CALL:
                self.pending_call = {
                    "name": event.item.name,
                    "call_id": event.item.call_id,
                    "item_id": event.item.id,
                }

        elif event.type == ServerEventType.RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
            if self.pending_call and event.call_id == self.pending_call["call_id"]:
                self.pending_call["arguments"] = event.arguments

        elif event.type == ServerEventType.RESPONSE_DONE:
            self.active_response = False
            if self.pending_call and "arguments" in self.pending_call:
                await self._run_tool(self.pending_call)
                self.pending_call = None

        elif event.type == ServerEventType.ERROR:
            msg = event.error.message
            if "no active response" not in msg.lower():
                print(f"[error] {msg}")

    async def _run_tool(self, call: Dict[str, Any]) -> None:
        name = call["name"]
        func = AVAILABLE_FUNCTIONS.get(name)
        if not func:
            print(f"[error] model asked for unknown tool '{name}'")
            return

        try:
            args = json.loads(call["arguments"]) if call["arguments"] else {}
        except json.JSONDecodeError:
            args = {}

        print(f"[tool] {name}({args})")
        try:
            result = func(args)
        except Exception as exc:  # never let a tool crash the call
            result = {"error": f"The system is temporarily unavailable: {exc}"}
        print(f"[tool] -> {result}")

        await self.connection.conversation.item.create(
            previous_item_id=call["item_id"],
            item=FunctionCallOutputItem(
                call_id=call["call_id"], output=json.dumps(result)
            ),
        )
        # Ask the model to speak using what the tool returned.
        await self.connection.response.create()


# ---------------------------------------------------------------------------
# 6. STARTUP
# ---------------------------------------------------------------------------

def main() -> None:
    endpoint = os.environ.get("AZURE_VOICELIVE_ENDPOINT")
    api_key = os.environ.get("AZURE_VOICELIVE_API_KEY")
    model = os.environ.get("AZURE_VOICELIVE_MODEL", "gpt-realtime")
    voice = os.environ.get("AZURE_VOICELIVE_VOICE", "en-US-Ava:DragonHDLatestNeural")

    if not endpoint:
        sys.exit("AZURE_VOICELIVE_ENDPOINT is not set. Copy .env.example to .env "
                 "and fill it in.")

    if api_key:
        credential: Any = AzureKeyCredential(api_key)
    else:
        # Keyless: uses whoever is signed in via `az login`.
        from azure.identity.aio import AzureCliCredential
        credential = AzureCliCredential()
        print("No API key found -- using your Azure CLI login.")

    agent = SupportAgent(endpoint, credential, model, voice)

    def _stop(_sig, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGINT, _stop)

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        print("\nCall ended. Goodbye!")


if __name__ == "__main__":
    main()