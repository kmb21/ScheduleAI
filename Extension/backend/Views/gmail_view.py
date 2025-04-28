from quart import Blueprint, request, jsonify, Response
import asyncio
import json
from DAL.gmail_dal import build_email_blocks, chunk_blocks, remove_duplicates
from Utils.openai_utils import _ask_openai_gmail, _build_prompt

gmail_blueprint = Blueprint('gmail', __name__)

@gmail_blueprint.route('/parse', methods=['POST'])
async def parse_text():
    data = await request.get_json()
    raw_text = data.get('text', '')
    user_timezone = data.get("user_timezone", "America/New_York")
    user_email = 'mkumbon1@swarthmore.edu'
    print('user timezone: ', user_timezone)

    if not raw_text:
        return jsonify({'error': 'No text provided'}), 400

    raw_dict = json.loads(raw_text)
    loop = asyncio.get_event_loop()
    email_blocks = await loop.run_in_executor(None, lambda: build_email_blocks(raw_dict.get("emails", [])))
    chunks = await loop.run_in_executor(None, lambda: chunk_blocks(email_blocks))

    all_events = []

    async def generate_events():
        tasks = [asyncio.create_task(_ask_openai_gmail(_build_prompt(chunk, user_timezone))) for chunk in chunks]
        pending = set(tasks)
        task_to_index = {task: i for i, task in enumerate(tasks)}

        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)

            for completed_task in done:
                idx = task_to_index[completed_task]
                try:
                    result = completed_task.result()
                    new_events = remove_duplicates('mkumbon1@swarthmore.edu', result)
                    if new_events:
                        all_events.extend(new_events)
                        yield json.dumps({
                            "chunk_index": idx,
                            "total_chunks": len(chunks),
                            "new_events": new_events,
                            "all_events": all_events
                        }) + "\n"
                except Exception as e:
                    yield json.dumps({
                        "chunk_index": idx,
                        "total_chunks": len(chunks),
                        "error": str(e),
                        "new_events": [],
                        "all_events": all_events
                    }) + "\n"

        yield json.dumps({
            "complete": True,
            "total_chunks": len(chunks),
            "new_events": [],
            "all_events": all_events
        }) + "\n"

    return Response(generate_events(), mimetype="application/x-ndjson")
