import json
import httpx
import os

api_key = os.getenv("OPENAI_API_KEY")

def _build_prompt(chunk:str, user_timezone: str)->str:
    example_event = {
    "event": "CS Department Info Session",
    "raw_subject": "[Reminder] CS Dept Fall info session today!",
    "time": {
        "iso": "2025-04-10T16:30/2025-04-10T17:30",
        "display": "April 10, 4:30 PM – 5:30 PM"
    },
    "context": "Fall course planning event in Sci 204",
    "sender": "Chris Murphy",
    "urgency": "high",
    "gmailThread": "17a4c5f0b1c…"
}
    example_block = json.dumps({"events": [example_event]}, indent=2)
    return f"""
Extract only scheduling-related information that a college student might reasonably want to add to their calendar.

Format each event as a JSON object with exactly these fields:
- event: A short, cleaned title for the event (something nice to display to the user)
- raw_subject: The original subject line from the message (to use it for identifying duplicates later)
- time: ▸iso: A **single ISO-8601 string** (converted to {user_timezone}) that the UI can pass straight to Google Calendar  
          • If you know both start and end →  `"YYYY-MM-DDTHH:MM/YYYY-MM-DDTHH:MM"`  
          • If you know only the start → `"YYYY-MM-DDTHH:MM"`  
          • If only a day is clear → `"YYYY-MM-DD"`  
          • Otherwise output `"Not specified"`
        ▸display: The time converted to {user_timezone} in whatever is easiest for a person to read (e.g.,"Every Tuesday, 1–2 PM", "April 10, 4:30 PM EST"). If iso is "Not specified", set display to "Not specified" as well.
- context: Brief description or purpose of the event
- sender: Who sent or organized it
- urgency: "high", "medium", or "low" (based on time sensitivity and proximity)
- gmailThread: The thread ID of the email this event came from.

TIME ZONE RULES:
• If a time zone (e.g., EST, PST, GMT) is mentioned in the text, respect it and convert the time from that timezone to {user_timezone}.
• If no time zone is mentioned, assume the user's time zone is {user_timezone}
• The ISO string should be the offsetted time(ie converted to the {user_timezone}) (e.g., -05:00 for EST)
• The display time should also be the converted time and it should be in the {user_timezone}. Also add the usertimezone at the end e.g EST

FIELD RULES 
•urgency  
    -high : starts in ≤48h or hard deadline in ≤48h  
    -medium : within 7 days  
    -low : later than 7 days or date unclear  
• gmailMsgId / gmailThread - take from `data-legacy-message-id` and `data-legacy-thread-id`

Do not explain anything. Do not include markdown. Only output pure JSON.

Output ONLY a valid JSON object like this:
{example_block}

Text to analyze:
{chunk}
"""

async def _ask_openai_gmail(prompt:str,)->list[dict]:
    """Call the OpenAI chat endpoint and return the `events` list (can be empty)."""
    async with httpx.AsyncClient(timeout=120) as client:
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
            "temperature": 0.1,
            "max_tokens": 4096,
        }

        resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        cleaned_content = raw.replace('```json', '').replace('```', '').strip()
        return json.loads(cleaned_content).get("events", [])
    



async def _ask_openai(payload)->list[dict]:
    """Call the OpenAI chat endpoint and return the `events` list (can be empty)."""
    async with httpx.AsyncClient(timeout=120) as client:
        headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }

        resp = await client.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]
        cleaned_content = raw.replace('```json', '').replace('```', '').strip()
        return json.loads(cleaned_content)