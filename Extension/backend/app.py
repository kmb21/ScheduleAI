from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os

app = Flask(__name__)
CORS(app)

openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route('/parse', methods=['POST'])
def parse_text():
    data = request.json
    raw_text = data.get('text', '')

    if not raw_text:
        return jsonify({'error': 'No text provided'}), 400

    prompt = f"""
Extract all scheduling-related information from the following text and return a JSON array.
Each item should include:
- event: A short title or summary of the event
- time: The time or date it occurs
- context: Any extra details that explain the event

Format:
[
  {{
    "event": "Meeting with Bob",
    "time": "April 10, 2PM",
    "context": "Follow-up on design"
  }}
]

Text:
{raw_text[:3000]}
"""

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that extracts scheduling information from user-provided website text. Focus on finding events, meetings, deadlines, and reminders. Return your answer in a human-readable summary.You are a helpful assistant that extracts scheduling information from user-provided website text. Focus on finding events, meetings, deadlines, and reminders. Return your answer in a structure json"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )

        content = response.choices[0].message['content']
        return jsonify({'structured': content})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
