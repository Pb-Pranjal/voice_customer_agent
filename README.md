# Maya Voice Customer Support Agent

Maya is a voice customer-support demo built with FastAPI, React, and Azure Voice Live. It supports browser microphone input, live assistant audio, speech transcription, order lookup, refund requests, and human escalation.

## Features

- Browser voice session with PCM16 mono audio at 24 kHz
- Azure Voice Live WebSocket session with server-side semantic VAD
- Assistant audio playback and conversation transcript
- JSON-backed order lookup, refund, and escalation workflows
- REST API for order, refund, and escalation actions
- Safe browser and backend voice diagnostics controlled by `VOICE_DEBUG`

## Project Layout

```text
.
├── server.py                 # FastAPI REST API and Azure Voice Live proxy
├── order_store.py            # JSON-backed order and refund data layer
├── data/orders.json          # Prototype order and refund data
├── support_agent.py          # Standalone PyAudio Voice Live example
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
└── frontend/
    ├── src/
    │   ├── hooks/useVoice.js # WebSocket, microphone, PCM, and playback flow
    │   └── pages/VoiceAssistant.jsx
    └── public/pcm-processor.js
```

## Requirements

- Python 3.11 or newer
- Node.js and npm
- An Azure Voice Live resource and deployment
- A browser with microphone support

## Configuration

Copy the environment template and set your Azure values:

```powershell
Copy-Item .env.example .env
```

Set these variables in `.env`:

```text
AZURE_VOICELIVE_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
AZURE_VOICELIVE_API_KEY=<your-key>
AZURE_VOICELIVE_MODEL=gpt-realtime
AZURE_VOICELIVE_VOICE=en-US-Ava:DragonHDLatestNeural
```

Never commit `.env` or expose the API key in frontend code. If a key has been exposed, rotate it in Azure.

## Run Locally

### Backend

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

The backend runs at `http://127.0.0.1:8000`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

The Vite development server proxies `/api` and `/ws` to the FastAPI backend.

## Voice Flow

1. The browser opens `/ws/voice`.
2. The browser requests microphone permission with `getUserMedia({ audio: true })`.
3. `pcm-processor.js` converts the microphone stream to mono PCM16 and resamples it to 24 kHz.
4. PCM bytes are Base64 encoded on the browser main thread and sent as `input_audio_buffer.append`.
5. FastAPI forwards the events unchanged to Azure Voice Live.
6. Azure server-side semantic VAD detects the end of the user turn.
7. Azure transcription and response events are forwarded to React.
8. React displays transcription and decodes assistant PCM16 audio for playback.

The client does not commit every audio chunk. The session uses Azure server-side VAD to determine turn boundaries.

## Debugging Voice Input

Set this in `.env` and restart the backend:

```text
VOICE_DEBUG=true
```

Then inspect:

- Browser DevTools Console for `Microphone granted`, `AudioContext ready`, `PCM chunk`, and `input_audio_buffer.append` logs.
- Backend logs for `[Browser -> Azure]` and `[Azure -> Browser]` event types.
- The Voice Assistant state: Connecting, Requesting microphone, Listening, User speaking, Processing, Speaking, or Error.

A healthy session should show non-empty PCM chunks and repeated `input_audio_buffer.append` messages while the microphone is active.

## REST Endpoints

- `GET /api/orders/{order_id}`
- `POST /api/refund`
- `GET /api/refunds`
- `POST /api/escalate`
- `WS /ws/voice`

Demo order IDs include `A1001`, `A1002`, and `A1003`.

`POST /api/refund` keeps the original ticket, amount, and processing time
fields and also returns `refund_status`, `requested_at`, and the updated order.
Unknown orders return `404`, ineligible orders return `400`, and duplicate
requests return `409`. Refunds remain `requested` until a separate fulfillment
workflow changes their status.

## Validation

Frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

Backend syntax check:

```powershell
python -m py_compile server.py support_agent.py
```

## Security Notes

- Keep Azure credentials in `.env` only.
- Do not paste API keys into browser logs, screenshots, source files, or commits.
- Use HTTPS in deployed environments so browser microphone permissions work reliably.
