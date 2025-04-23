from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import requests
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
import tiktoken
from DAL.gmail_dal import build_email_blocks, chunk_blocks, remove_duplicates
import os

MAX_WORKERS = min(os.cpu_count()*2 or 4, 16)
app = Flask(__name__)
CORS(app, origins=["chrome-extension://<your-extension-id>"])

api_key = os.getenv("OPENAI_API_KEY")

def _build_prompt(chunk:str)->str:
    return f"""
Extract only scheduling-related information that a college student might reasonably want to add to their calendar.

Include ONLY:
- Events that involve participation: classes, talks, info sessions, office hours, interviews, workshops, deadlines, reminders, etc.
- Events with a clear time or date mentioned.

Exclude:
- Advertisements, promotional content, livestreams, webinars from companies (e.g. Canva, LinkedIn, Amazon)
- News, product launches, general updates, or generic reminders without a clear scheduling purpose

Format each event as a JSON object with exactly these fields:
- event: A short, cleaned title for the event (something nice to display to the user)
- raw_subject: The original subject line from the message (to use it for identifying duplicates later)
- time: Date and/or time (or "Not specified" if unclear)
- context: Brief description or purpose of the event
- sender: Who sent or organized it
- urgency: "high", "medium", or "low" (based on time sensitivity and proximity)

Output ONLY a valid JSON object like this:
{{
  "events": [
    {{
      "event": "CS Department Info Session",
      "raw_subject": "[All] [Reminder] CS Dept Fall info session today!",
      "time": "April 10, 4:30pm",
      "context": "Fall course planning event in Sci 204",
      "sender": "Chris Murphy",
      "urgency": "high",
      "gmailMsgId": "17a4c5f0b1c…",        // empty string if unavailable
      "gmailThread": "17a4c5f0b1c…"        // empty string if unavailable
    }}
  ]
}}

FIELD RULES 
•urgency  
    -high : starts in ≤48h or hard deadline in ≤48h  
    -medium** : within 7 days  
    -low : later than 7 days or date unclear  
• **gmailMsgId / gmailThread** - take from `data-legacy-message-id` and `data-legacy-thread-id`

Do not explain anything. Do not include markdown. Only output pure JSON.

Text to analyze:
{chunk}
"""

def _ask_openai(prompt:str)->list[dict]:
    """Call the OpenAI chat endpoint and return the `events` list (can be empty)."""
    
    headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }

    payload = {
        "model": "gpt-4o",
        "response_format": { "type": "json_object" },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a precise assistant that extracts scheduling-related information "
                    "from user-provided website text. Your output MUST be a valid JSON object only. "
                    "Focus on real events, meetings, deadlines, workshops, and reminders. "
                    "Ignore promotions, ads, news articles, and anything unrelated to scheduling. "
                    "Be strict. Output clean, deduplicated, readable data."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": 4096,
    }
    resp = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=120
                )

    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"]
    cleaned_content = raw.replace('```json', '').replace('```', '').strip()
    return json.loads(cleaned_content).get("events", [])


@app.route('/')
def hello_world():
    return "Hello from Flask!"

@app.route('/parse', methods=['POST'])
def parse_text():
    data = request.json
    raw_text = data.get('text', '')
    if not raw_text:
        return jsonify({'error': 'No text provided'}), 400
    
    raw_dict = json.loads(raw_text)
    print(raw_dict.get("emails", []))
    email_blocks = build_email_blocks(raw_dict.get("emails", []))
    chunks = chunk_blocks(email_blocks)
    
    # Keep track of processed events to avoid duplicates in the stream
    all_events    : list[dict] = []

    
    @stream_with_context
    def generate():
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            # submit one future per chunk
            future_map = {
                pool.submit(_ask_openai, _build_prompt(chunk)): idx
                for idx, chunk in enumerate(chunks)
            }

            for future in as_completed(future_map):
                idx = future_map[future]
                try:
                    chunk_events = future.result()
                except Exception as exc:
                    print(all_events)
                    yield json.dumps({
                        "chunk_index" : idx,
                        "total_chunks": len(chunks),
                        "error"       : str(exc),
                        "new_events"  : [],
                        "all_events"  : all_events
                    }) + "\n"
                    continue

                new_events = remove_duplicates(chunk_events)
                

                if new_events:
                    all_events.extend(new_events)# stream immediately
                    print(all_events)
                    yield json.dumps({
                        "chunk_index" : idx,
                        "total_chunks": len(chunks),
                        "new_events"  : new_events,
                        "all_events"  : all_events
                    }) + "\n"

        # ── final summary ──────────────────────────────────────────
        # unique_final = remove_duplicates(all_events)             # DB-level check
        print(all_events)
        yield json.dumps({
            "complete"     : True,
            "total_chunks" : len(chunks),
            "new_events"   : [],          # nothing new – already sent
            "all_events"   : all_events
        }) + "\n"

    return Response(generate(), mimetype="application/x-ndjson")

if __name__ == '__main__':
    app.run(debug=True, port=5001)