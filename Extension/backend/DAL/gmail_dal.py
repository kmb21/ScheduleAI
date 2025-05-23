# dal.py (Data Access Layer)
import sqlite3
import os
import tiktoken


DB_FILE = 'events.db'
MAX_TOKENS = 4000

# Setup tokenizer for token counting
encoding = tiktoken.encoding_for_model("gpt-4")

def count_tokens(text):
    return len(encoding.encode(text))

def build_email_blocks(emails):
    blocks = []
    for email in emails:
        subject = email.get("subject", "No subject")
        sender = email.get("sender", "Unknown sender")
        snippet = email.get("snippet", "").replace('\xa0', ' ').replace('\u200c', '').replace('\ufeff', '').strip()
        gmailThread = email.get("gmailThread", "")

        block = f"gmailThread: {gmailThread}\nFrom: {sender}\nSubject: {subject}\nSnippet: {snippet}"
        blocks.append(block)
    return blocks

def chunk_blocks(blocks, max_tokens=MAX_TOKENS):
    chunks = []
    current_chunk = ""
    current_tokens = 0

    tokenized_blocks = [(block, count_tokens(block)) for block in blocks]

    for block, block_tokens in tokenized_blocks:
        if block_tokens > max_tokens:
            sentences = block.split(". ")
            temp = ""
            for sentence in sentences:
                if count_tokens(temp + sentence) > max_tokens:
                    if temp:
                        chunks.append(temp.strip())
                    temp = sentence + ". "
                else:
                    temp += sentence + ". "
            if temp.strip():
                chunks.append(temp.strip())
            continue

        if current_tokens + block_tokens > max_tokens:
            chunks.append(current_chunk.strip())
            current_chunk = block + "\n\n"
            current_tokens = block_tokens
        else:
            current_chunk += block + "\n\n"
            current_tokens += block_tokens

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks

# -------------------- DATABASE SETUP --------------------

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            raw_subject TEXT NOT NULL,
            sender TEXT NOT NULL,
            UNIQUE(user_email, raw_subject, sender)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            contact_email TEXT NOT NULL,
            frequency INTEGER DEFAULT 1,
            UNIQUE(user_email, contact_email)
        )
    ''')
    conn.commit()
    conn.close()
    
    
def save_contact(user_email, contact_email):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO contacts (user_email, contact_email, frequency)
            VALUES (?, ?, 1)
            ON CONFLICT(user_email, contact_email)
            DO UPDATE SET frequency = frequency + 1
        ''', (user_email.lower(), contact_email.lower()))
        conn.commit()
    finally:
        conn.close()


def get_suggested_contacts(user_email, limit=None):
    """Get suggested contacts, optionally limited by count.
    
    Args:
        user_email: Email of the user whose contacts to fetch
        limit: Maximum number of contacts to return (None for all contacts)
    
    Returns:
        List of contact emails (or email/name tuples if selected)
    """
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    query = '''
        SELECT contact_email
        FROM contacts
        WHERE user_email = ?
        ORDER BY frequency DESC
    '''
    
    params = (user_email.lower(),)
    
    if limit is not None:
        query += ' LIMIT ?'
        params += (limit,)
    
    c.execute(query, params)
    results = c.fetchall()
    conn.close()
    
    # Return list of emails (unwrap single-element tuples)
    return [row[0] for row in results]



def save_event(user_email, raw_subject, sender):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT OR IGNORE INTO events (user_email, raw_subject, sender)
            VALUES (?, ?, ?)
        ''', (user_email.strip().lower(), raw_subject.strip().lower(), sender.strip().lower()))
        conn.commit()
    finally:
        conn.close()
        


def event_seen(user_email, raw_subject, sender):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        SELECT 1 FROM events
        WHERE user_email = ? AND raw_subject = ? AND sender = ?
    ''', (user_email.strip().lower(), raw_subject.strip().lower(), sender.strip().lower()))
    result = c.fetchone()
    conn.close()
    return result is not None


def remove_duplicates(user_email, events):
    unique_events = []
    for event in events:
        if not event_seen(user_email, event['raw_subject'], event['sender']):
            save_event(user_email, event['raw_subject'], event['sender'])
            unique_events.append(event)
        else:
            print(f"Duplicate found and removed: {event['raw_subject']} from {event['sender']}")
    return unique_events


init_db()
