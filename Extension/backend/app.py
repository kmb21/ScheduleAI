from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import logging
import json

app = Flask(__name__)
CORS(app, origins=["chrome-extension://<your-extension-id>"])


api_key = ""
@app.route('/')
def hello_world():
    return "Hello from Flask!"

@app.route('/parse', methods=['POST'])
def parse_text():
    data = request.json
    raw_text = data.get('text', '')

    if not raw_text:
        return jsonify({'error': 'No text provided'}), 400

#     prompt = f"""
# Extract all scheduling-related information from the following text and return a JSON array.
# Each item should include:
# - event: A short title or summary of the event
# - time: The time or date it occurs
# - context: Any extra details that explain the event

# Format:
# [
#   {{
#     "event": "Meeting with Bob",
#     "time": "April 10, 2PM",
#     "context": "Follow-up on design"
#   }}
# ]

# Text:
# {raw_text}
# """
    prompt = f"""
    Extract all scheduling-related information from the following text and return a JSON array.
    Follow these guidelines carefully:

    1. For each event include:
    - event: Short title (include sender name/organization if relevant)
    - time: Specific time/date or "Not specified"
    - context: Additional details about purpose/agenda
    - sender: Who sent this (person/organization)
    - urgency: "high"/"medium"/"low" based on time sensitivity

    2. Important rules:
    - Always preserve sender/organization names
    - Infer dates/times from context when possible
    - Mark time-sensitive items clearly
    - Return pure JSON only (no markdown or code blocks)

    Example format:
    {{
    "events": [
        {{
        "event": "Team Sync (from Acme Corp)",
        "time": "Tomorrow 10AM EST",
        "context": "Quarterly planning review",
        "sender": "Sarah Kim (Acme Corp)",
        "urgency": "medium"
        }}
    ]
    }}

    Text to analyze:
    {raw_text}
    """
    print("here")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant that extracts scheduling information from user-provided website text. Focus on finding events, meetings, deadlines, and reminders. Return your answer in a human-readable summary.You are a helpful assistant that extracts scheduling information from user-provided website text. Focus on finding events, meetings, deadlines, and reminders. Return your answer in a structured json"
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1024
    }

    try:
        logging.debug("Sending request to OpenAI API...")
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload
        )

        data = response.json()
        logging.debug("Received response from OpenAI.")
        if 'choices' not in data or not data['choices']:
            logging.error("Unexpected API response format - missing choices")
            print(data)
            return jsonify({'error': 'Unexpected API response format'}), 500
        raw_content = data['choices'][0]['message']['content']
         # Clean and parse the JSON content
        try:
            cleaned_content = raw_content.replace('```json', '').replace('```', '').strip()
            json_content = json.loads(cleaned_content)
            print(json_content)
            return jsonify({'structured': json_content})
            
        except json.JSONDecodeError as json_err:
            logging.error(f"Failed to parse JSON content: {json_err}")
            return jsonify({
                'error': 'Failed to parse response content',
                'raw_content': raw_content
            }), 500
        # print(content)
        # return jsonify({'structured': content})

    except requests.exceptions.RequestException as e:
        logging.error(f"Error during API request: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
