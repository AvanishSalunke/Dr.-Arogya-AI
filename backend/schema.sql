DROP TABLE IF EXISTS conversations;

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,         -- Links messages to a specific user/session
    sender TEXT NOT NULL,             -- 'user' or 'ai'
    message TEXT NOT NULL,            -- The actual chat text
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    triage_status TEXT DEFAULT 'INTAKE_START' -- Tracks the doctor's step in the interview
);