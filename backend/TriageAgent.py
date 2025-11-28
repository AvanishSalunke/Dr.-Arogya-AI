import os
from groq import Groq
from typing import List, Dict, Any

# Ensure we use absolute import
from db_manager import DBManager 

# --- Configuration ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile" 

# --- System Instruction ---
SYSTEM_INSTRUCTION = """
You are the Arogya.AI Medical Triage Assistant. You must adhere to the following strict protocol:

1.  **Language Adherence:** You MUST dynamically detect the user's input language (English, Hindi, or Marathi) and respond ONLY in that language.
2.  **Triage Protocol:**
    a.  **One Question Only:** Ask only ONE question at a time.
    b.  **Gather Symptoms:** Continue asking relevant questions until you have enough information.
    c.  **First-Aid Advice:** Provide BRIEF first-aid advice.
    d.  **Location Request:** Finally, ask for the user's CURRENT LOCATION (City/Area).
3.  **Conversation Context:** Use the provided history to inform your questions.
4.  **Final Output:** The conversation is complete when you have provided advice and requested location.
"""

class TriageAgent:
    """
    Manages the conversational triage process using Groq's Llama model 
    and leverages the database for chronological memory.
    """
    def __init__(self, db_manager: DBManager):
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY environment variable not set.")
        self.client = Groq(api_key=GROQ_API_KEY)
        self.db_manager = db_manager

    def process_message(self, session_id: str, user_message: str) -> str:
        """
        Processes a user message, maintaining conversation history for context.
        """
        
        # 1. Fetch Conversation History
        # We catch potential DB errors here to prevent crashing if DB isn't ready
        try:
            history = self.db_manager.get_conversation_history(session_id)
        except Exception as e:
            print(f"DB Error fetching history: {e}")
            history = []

        # 2. Add System Instruction and Context
        messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        try:
            # 3. Call Groq API
            chat_completion = self.client.chat.completions.create(
                messages=messages,
                model=GROQ_MODEL,
                temperature=0.6,
            )
            
            assistant_response = chat_completion.choices[0].message.content

            # 4. Save to Database (FIXED HERE)
            # We explicitly pass "INTAKE" as the triage_status to satisfy the DB requirement
            self.db_manager.add_message(session_id, "user", user_message, "INTAKE")
            self.db_manager.add_message(session_id, "assistant", assistant_response, "INTAKE")

            return assistant_response

        except Exception as e:
            print(f"Groq API Error: {e}")
            return "I apologize, but I'm currently experiencing a technical issue. Please try again."