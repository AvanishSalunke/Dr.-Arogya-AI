import sqlite3
import os
from flask import g, Flask

# 1. Configuration
# Define the path relative to where app.py is executed (which is 'backend')
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chats.db')
SCHEMA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schema.sql')

# --- Helper Functions (remain global as they rely on Flask's 'g' context) ---

def get_db():
    """Connects to the specified database using Flask's application context."""
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        # Configure SQLite to return rows as dictionaries
        db.row_factory = sqlite3.Row
    return db

def close_db(e=None):
    """Closes the database connection."""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# --- DBManager Class (Expected by TriageAgent) ---

class DBManager:
    def __init__(self):
        # The connection logic itself is handled by get_db() and Flask context.
        pass

    def init_db(self):
        """Initializes the database schema. Called once on startup."""
        # Use a temporary connection since 'g' context is not available during startup
        temp_conn = sqlite3.connect(DATABASE)
        try:
            with open(SCHEMA_FILE, 'r') as f:
                temp_conn.executescript(f.read())
            temp_conn.commit()
            print("Database schema initialized successfully.")
        except sqlite3.Error as e:
            print(f"Error initializing DB: {e}")
        finally:
            temp_conn.close()

    # --- CRUD Operations for Chat History (Using Flask context) ---

    def add_message(self, session_id: str, sender: str, message: str, triage_status: str):
        """Inserts a new message and updates the session's status."""
        db = get_db()
        db.execute(
            'INSERT INTO conversations (session_id, sender, message, triage_status) VALUES (?, ?, ?, ?)',
            (session_id, sender, message, triage_status)
        )
        db.commit()

    def get_conversation_history(self, session_id: str):
        """
        Retrieves all messages for a given session in the format required by Groq API.
        
        Format: [{'role': 'user/assistant', 'content': 'message'}]
        """
        db = get_db()
        messages = db.execute(
            'SELECT sender, message FROM conversations WHERE session_id = ? ORDER BY timestamp ASC',
            (session_id,)
        ).fetchall()
        
        # Transform the rows into the required API format
        history = []
        for row in messages:
            # Groq API uses 'assistant' role instead of 'ai'
            role = 'assistant' if row['sender'] == 'ai' else row['sender']
            history.append({
                'role': role, 
                'content': row['message']
            })
        return history

    def get_triage_status(self, session_id: str):
        """Retrieves the latest triage status for the session."""
        db = get_db()
        status = db.execute(
            'SELECT triage_status FROM conversations WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1',
            (session_id,)
        ).fetchone()
        
        # If no history, return the default starting status
        return status['triage_status'] if status else 'INTAKE_START'
        
def register_db_hooks(app: Flask):
    """Registers the teardown hook for closing the database connection."""
    app.teardown_appcontext(close_db)

# Since app.py now calls DBManager().init_db(), we don't need to call it globally here.