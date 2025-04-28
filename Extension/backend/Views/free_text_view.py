from quart import Blueprint, request, jsonify
import json
import asyncio
from Utils.openai_utils import _ask_openai
from DAL.gmail_dal import save_contact

free_text_blueprint = Blueprint('free_text', __name__)

@free_text_blueprint.route('/parse_free_text', methods=['POST'])
async def parse_free_text():
    try:
        data = await request.get_json()
        text = data.get('text', '')
        user_timezone = data.get('user_timezone', 'America/New_York')
        user_email = 'mkumbon1@swarthmore.edu'
        user_now = data.get('user_now', None)

        if not text.strip():
            return jsonify({'error': 'Empty input'}), 400
        
        prompt = f"""
Extract scheduling information from the text and output it in JSON format. 
Follow these strict rules:

1. Extract the actual meeting time from the user's text. 
   - If both start and end time are mentioned, use them.
   - If only a start time is mentioned, assume a default duration:
     ▸ 30 minutes for casual events (coffee, catch-up)
     ▸ 1 hour for formal events (meetings, interviews, classes).
2. Respect the user's current time: {user_now} 
   - Correctly interpret words like "today", "tomorrow", "next Friday", etc.
3. If the user specify's a timezone different from their current timezone: {user_timezone}, correctly convert (e.g if user says 4pm PST but they are in NewYork, then correctly convert to their time)
4. Extract any participant emails mentioned in the text (e.g., emails with '@').
5. Output times in this format:
   - **iso**: Single ISO-8601 string (either start only or start/end separated by "/")
   - **display**: Easy-to-read version for humans
6. Final output must be a pure valid JSON object like this:

{{
  "events": [
    {{
      "title": "Meeting title",
      "time": {{
          "iso": "2025-04-10T14:00:00-04:00/2025-04-10T15:00:00-04:00",
          "display": "Apr 10, 2:00 PM – 3:00 PM EDT"
      }},
      "participants": ["person1@example.com", "person2@example.com"],
      "description": "Brief description or purpose"
    }}
  ]
}}

⚠️ IMPORTANT:
- If no participants are mentioned, leave participants as an empty list.
- Always guess a reasonable end time if only start time is provided.
- NEVER output extra explanation. Only the JSON object.

Text to analyze:
{text}
"""


        payload = {
                "model": "gpt-4o",
                "response_format": { "type": "json_object" },
                "messages": [
                    {
                        "role": "system",
                        "content": (
                                                "You are a precise scheduling assistant that extracts:"
                                                "- Event titles\n- Times (with timezone conversion)\n- Participants\n"
                                                "STRICT RULES:\n"
                                                "1. ALWAYS output valid JSON\n"
                                                "2. Convert ALL times to specified timezone\n"
                                                "3. Skip the user's own email in participants\n"
                                                "4. Be concise but descriptive"
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

        try:
            print(f"Calling OpenAI API with text: {text[:50]}...")
            response = await _ask_openai(payload)
            print(f"OpenAI response received: {response}")
            print(type(response))
            
            if not response:
                return jsonify({'error': 'Empty response from OpenAI'}), 500
                
            if 'events' not in response:
                return jsonify({'error': 'Response missing events field', 'response': response}), 500

            # Save new contacts to DB
            try:
                for event in response['events']:
                    for email in event.get('participants', []):
                        try:
                            save_contact(user_email, email)
                            print(f"Saved contact: {email}")
                        except Exception as contact_err:
                            print(f"Error saving contact {email}: {str(contact_err)}")
                            # Continue execution even if saving contacts fails
            except Exception as save_err:
                print(f"Error in contact saving loop: {str(save_err)}")
                # Continue execution even if saving contacts fails
                
            return jsonify(response)

        except Exception as api_err:
            import traceback
            print(f"OpenAI API error: {str(api_err)}")
            traceback.print_exc()
            return jsonify({'error': f'OpenAI API error: {str(api_err)}'}), 500

    except Exception as e:
        import traceback
        print(f"General error in parse_free_text: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500