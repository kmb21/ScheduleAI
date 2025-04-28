import asyncio
import requests
import json
import os


# Replace with your actual OpenAI API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

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

async def ask_gpt(prompt):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    payload = {
        "model": "gpt-3.5-turbo",  # or "gpt-4" if you have access
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }
    
    try:
        response = requests.post(OPENAI_API_URL, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        print(f"Error making API request: {e}")
        return None

async def test_timezone_conversion():
    # Fake blocks (chunk examples)
    emails = [
        """Subject: Meeting with team
        From: John Doe <john@example.com>
        Snippet: Let's meet on April 30, 2025 at 3 PM EST.""",

        """Subject: Office Hours Reminder
        From: Professor Smith <smith@university.edu>
        Snippet: Reminder: Office hours are on May 2, 2025, at 1 PM PST.""",

        """Subject: Project Presentation
        From: Manager <manager@company.com>
        Snippet: Your project presentation is scheduled for May 5, 2025, 10 AM.""",  # No timezone mentioned

        """Subject: Club Meeting
        From: Student Club <club@school.edu>
        Snippet: Meeting on May 7, 2025, at 5:30 PM GMT."""
    ]

    # Assume user timezone
    user_timezone = "America/New_York"

    for idx, email_chunk in enumerate(emails):
        prompt = _build_prompt(email_chunk, user_timezone)
        events = await ask_gpt(prompt)
        print(f"\n--- Chunk {idx+1} ---")
        print(events)

if __name__ == "__main__":
    asyncio.run(test_timezone_conversion())