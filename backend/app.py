import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# --- IMPORT AGENTS ---
# Note: Ensure these files use absolute imports (e.g., "from db_manager import ...")
from db_manager import DBManager
from TriageAgent import TriageAgent
from LocationAgent import LocationAgent

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- INITIALIZATION ---
# 1. Setup Database
db_manager = DBManager()

# 2. Setup Agents
try:
    triage_agent = TriageAgent(db_manager)
    location_agent = LocationAgent()
    logger.info("Agents initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize agents: {e}")
    # We don't exit here so the server can start, but it will error on requests if keys are missing

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    user_message = data.get('message', '')
    session_id = data.get('session_id') # Get the ID sent from frontend

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    logger.info(f"Session: {session_id} | User: {user_message}")

    try:
        # --- STEP 1: GET TRIAGE RESPONSE ---
        # The agent uses the session_id to pull history from the DB automatically
        ai_response_text = triage_agent.process_message(session_id, user_message)

        # --- STEP 2: ANALYZE STATUS ---
        # We need a heuristic to decide if triage is "done" and we should show the map.
        # Simple Logic: If the AI asks for "location" or says "nearby", we assume it's the final stage.
        # (You can refine this by making the TriageAgent return a structured JSON if preferred)
        
        is_final_stage = False
        map_data = None
        
        # Check for keywords indicating the end of triage/start of location search
        # These keywords should match your TriageAgent's instructions
        trigger_words = ["location", "city", "area", "zip code", "where are you"]
        if any(word in ai_response_text.lower() for word in trigger_words) and len(ai_response_text) < 300:
            # If AI is asking for location, we might not be *done*, but if the USER *gave* the location
            # in this turn, we need to trigger the search.
            
            # IMPROVED LOGIC: 
            # If the User's message looks like a location (e.g., "I am in Mumbai"), 
            # run the location agent.
            pass

        # --- STEP 3: HANDLE LOCATION SEARCH ---
        # If we detect the user provided a location or the conversation implies it
        # Ideally, we run the location agent if the triage is complete.
        
        # For this setup, let's assume if the AI response contains "medical facilities" or "hospitals",
        # it means it has found them (or we need to find them).
        
        # TEMPORARY LOGIC for "Production Readiness":
        # If the user input is short and looks like a place name (after triage started), search.
        # OR better: The Triage Agent should output a specific flag. 
        
        # Since we can't change the Agent's return type easily without breaking history:
        # We will check if the user message *is* the location input.
        # (You might want to add a state in your DB to track "AWAITING_LOCATION")
        
        treatment_plan = None
        
        # If the AI response suggests looking for a hospital, let's trigger the search
        # based on the *User's* message (assuming they just replied with their city).
        if "locating" in ai_response_text.lower() or "finding" in ai_response_text.lower():
             # Run Location Search on the USER'S message
             logger.info(f"Triggering location search for: {user_message}")
             loc_results = location_agent.find_nearby_hospitals(user_message)
             
             if loc_results['success']:
                 map_data = loc_results['hospitals']
                 is_final_stage = True
                 treatment_plan = ai_response_text # The AI's advice is the plan
                 ai_response_text = f"I found {len(map_data)} facilities near you. Please check the map below."

        # --- STEP 4: CONSTRUCT RESPONSE ---
        response_payload = {
            "status": "COMPLETE" if is_final_stage else "INTAKE",
            "is_final": is_final_stage,
            "voice_response": ai_response_text,
            "treatment_plan": treatment_plan if is_final_stage else None,
            "map_data": map_data
        }

        return jsonify(response_payload)

    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return jsonify({"voice_response": "I encountered an internal error. Please try again."}), 500

if __name__ == '__main__':
    # Ensure DB schema is initialized
    db_manager.init_db()
    app.run(debug=True, port=5000)