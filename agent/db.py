# db.py — MongoDB Atlas Interface
# Handles all persistence: schedule, events, state, persona
# NOTE: All write operations are fault-tolerant — if MongoDB is unavailable
# (e.g. SSL issues in Google Colab), calls are silently skipped so that
# the Flask endpoints still return data to Node.js successfully.

from pymongo import MongoClient
from datetime import datetime
import os
import certifi

# ─────────────────────────────────────────
# CONNECTION
# ─────────────────────────────────────────

# Priority order:
# 1. MONGO_URI env var (set this in Colab before running!)
# 2. MONGO_URL env var (alternate name used in some Colab setups)
# 3. Hardcoded fallback to PersonaRX Atlas cluster
MONGO_URI = (
    os.environ.get("MONGO_URI") or
    os.environ.get("MONGO_URL") or
    "mongodb+srv://PersonaRX_Admin:Pradnya05Mahi03@cluster0.rqpaegu.mongodb.net/?appName=Cluster0"
)

# _db_available tracks if MongoDB is reachable. If False, all writes are no-ops.
_db_available = False
client        = None
db            = None
schedules_col = None
events_col    = None
state_col     = None

def _init_db():
    """Try to connect to MongoDB. Silently marks DB as unavailable on failure."""
    global client, db, schedules_col, events_col, state_col, _db_available
    try:
        client = MongoClient(
            MONGO_URI,
            tls=True,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,  # fail fast — don't block startup
        )
        # Force a real connection to check it works
        db = client["test"]
        db.list_collection_names()  # will throw if SSL fails

        schedules_col = db["prescriptions"]
        events_col    = db["doseevents"]
        state_col     = db["system_state"]
        _db_available = True
        print("✅ db.py: MongoDB connected successfully.")
    except Exception as e:
        _db_available = False
        print(f"⚠️  db.py: MongoDB unavailable ({type(e).__name__}: {str(e)[:80]})")
        print("   → All DB writes will be skipped. Node.js handles persistence.")

# Attempt connection at import time
_init_db()


# ─────────────────────────────────────────
# SCHEDULE
# ─────────────────────────────────────────

def save_schedule(schedule: list, session_id: str):
    if not _db_available:
        return
    try:
        schedules_col.update_one(
            {"session_id": session_id},
            {"$set": {
                "session_id":  session_id,
                "medications": schedule,
                "updated_at":  datetime.utcnow().isoformat()
            }},
            upsert=True
        )
    except Exception:
        pass  # Node already saved this


def get_schedule(session_id: str) -> list:
    if not _db_available:
        return []
    try:
        doc = schedules_col.find_one({"session_id": session_id})
        return doc.get("medications") or doc.get("schedule", []) if doc else []
    except Exception:
        return []


# ─────────────────────────────────────────
# EVENTS
# ─────────────────────────────────────────

def save_event(event: dict, session_id: str):
    if not _db_available:
        return
    try:
        event["session_id"] = session_id
        event.pop("_id", None)
        events_col.insert_one(event)
    except Exception:
        pass


def get_events(session_id: str) -> list:
    if not _db_available:
        return []
    try:
        cursor = events_col.find({"session_id": session_id}, {"_id": 0})
        return list(cursor)
    except Exception:
        return []


# ─────────────────────────────────────────
# SYSTEM STATE (persona + meal times)
# ─────────────────────────────────────────

def get_state(session_id: str) -> dict:
    if _db_available:
        try:
            doc = state_col.find_one({"session_id": session_id})
            if doc:
                doc.pop("_id", None)
                return doc
        except Exception:
            pass
    # Default state (returned when DB unavailable OR no doc found)
    return {
        "session_id":       session_id,
        "meal_times":       {"breakfast": "08:00", "lunch": "14:00", "dinner": "20:00"},
        "inferred_persona": None,
        "persona_scores":   {"forgetful": 0, "busy": 0, "anxious": 0},
        "adherence_history": [],
        "active_drugs":     [],
        "total_doses":      0,
        "taken_doses":      0
    }


def update_state(session_id: str, updates: dict):
    if not _db_available:
        return
    try:
        updates["session_id"] = session_id
        updates["updated_at"] = datetime.utcnow().isoformat()
        state_col.update_one(
            {"session_id": session_id},
            {"$set": updates},
            upsert=True
        )
    except Exception:
        pass


def append_adherence(session_id: str, record: dict):
    if not _db_available:
        return
    try:
        state_col.update_one(
            {"session_id": session_id},
            {
                "$push": {"adherence_history": record},
                "$set":  {"updated_at": datetime.utcnow().isoformat()}
            },
            upsert=True
        )
    except Exception:
        pass
