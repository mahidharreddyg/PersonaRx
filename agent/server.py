# server.py — Flask API Server
# Run this in Google Colab. Exposes 5 endpoints via ngrok.
# Your teammate's Express server calls these URLs.

# =========================
# COLAB SETUP (run once before importing this file)
# pip install flask flask-cors pymongo pyngrok
#
# Then set your MongoDB URI:
# import os
# os.environ["MONGO_URI"] = "mongodb+srv://PersonaRX_Admin:Pradnya05Mahi03@cluster0.rqpaegu.mongodb.net/?appName=Cluster0"
#
# If MONGO_URI env var is not set, db.py will use the fallback URI above.
# =========================

import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from pyngrok import ngrok

from scheduler  import generate_schedule, adjust_meal_times
from simulator  import simulate_schedule, compute_adherence, create_real_event
from planner    import infer_persona, replan_schedule, build_planning_summary
import db

# ─────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────

app = Flask(__name__)
CORS(app)   # allow Express to call from any origin


# ─────────────────────────────────────────
# HELPER: generate or validate session_id
# ─────────────────────────────────────────

def get_session(req) -> str:
    data = req.get_json(force=True, silent=True) or {}
    return data.get("session_id") or str(uuid.uuid4())


# ─────────────────────────────────────────
# ENDPOINT 1: POST /schedule
# Called after user confirms validated JSON
# ─────────────────────────────────────────

@app.route("/schedule", methods=["POST"])
def schedule():
    try:
        data = request.get_json(force=True, silent=True) or {}
        session_id = data.get("session_id") or str(uuid.uuid4())
        
        # ✅ ONLY medications
        medications = data.get("medications", [])
        if not medications:
            return jsonify({"error": "Need 'medications' array"}), 400
            
        meal_times = data.get("meal_times", {
            "breakfast": "08:00", "lunch": "14:00", "dinner": "20:00"
        })
        start_date = data.get("start_date")

        schedule_list = generate_schedule(medications, meal_times, start_date)

        # persist
        db.save_schedule(schedule_list, session_id)
        db.update_state(session_id, {
            "meal_times": meal_times,
            "active_drugs": [d.get("drug") for d in medications]
        })

        return jsonify({
            "session_id": session_id,
            "schedule": schedule_list,
            "meal_times": meal_times,
            "total_doses": len(schedule_list)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# ENDPOINT 2: POST /simulate
# Auto-called after /schedule for demo
# ─────────────────────────────────────────

@app.route("/simulate", methods=["POST"])
def simulate():
    """
    Input:
    {
        "session_id": str,
        "persona": "forgetful" | "busy" | "anxious"   (default: forgetful)
    }

    Output:
    {
        "session_id": str,
        "events": [ event_dicts ],
        "adherence": { score, taken, missed, delayed, total, percent }
    }
    """
    try:
        data       = request.get_json(force=True)
        session_id = data.get("session_id")
        persona    = data.get("persona", "forgetful")

        if not session_id:
            return jsonify({"error": "session_id is required"}), 400

        schedule_list = data.get("schedule")
        if not schedule_list:
            schedule_list = db.get_schedule(session_id)
            
        if not schedule_list:
            return jsonify({"error": "No schedule found. Pass 'schedule' array or call /schedule first."}), 404

        events    = simulate_schedule(schedule_list, persona)
        adherence = compute_adherence(events)

        # persist events
        for event in events:
            db.save_event(event, session_id)
            db.append_adherence(session_id, {
                "day":       event["day"],
                "drug_name": event["drug_name"],
                "status":    event["status"],
                "time":      event["scheduled_time"]
            })

        db.update_state(session_id, {
            "total_doses":  adherence["total"],
            "taken_doses":  adherence["taken"]
        })

        return jsonify({
            "session_id": session_id,
            "events":     events,
            "adherence":  adherence
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# ENDPOINT 3: POST /replan
# Called after simulation or after real events accumulate
# ─────────────────────────────────────────

@app.route("/replan", methods=["POST"])
def replan():
    try:
        data       = request.get_json(force=True)
        session_id = data.get("session_id")
        req_persona = data.get("requested_persona") # NEW: for demo consistency

        if not session_id:
            return jsonify({"error": "session_id is required"}), 400

        schedule_list   = data.get("schedule") or db.get_schedule(session_id)
        events          = data.get("events") or db.get_events(session_id)
        state           = db.get_state(session_id)
        meal_times      = state.get("meal_times", {
            "breakfast": "08:00", "lunch": "14:00", "dinner": "20:00"
        })

        if not schedule_list:
            return jsonify({"error": "No schedule found."}), 404

        # infer persona
        print(f"DEBUG: Processing /replan request for session: {session_id}")
        print(f"DEBUG: Requested Persona from UI: {req_persona}")
        
        persona_result = infer_persona(events, requested_persona=req_persona)
        inferred       = persona_result["persona"]
        print(f"DEBUG: Final Calculated Persona: {inferred}")

        # adjust meal times based on persona
        if inferred != "unknown":
            meal_times = adjust_meal_times(meal_times, inferred)

        # replan
        updated_schedule = replan_schedule(schedule_list, events, meal_times, persona=inferred)

        # compute adherence
        adherence = compute_adherence(events)

        # build summary (pass requested_persona to force correct reasoning strings)
        summary = build_planning_summary(schedule_list, updated_schedule, persona_result, adherence, req_persona)

        # persist
        db.save_schedule(updated_schedule, session_id)
        db.update_state(session_id, {
            "inferred_persona": summary["inferred_persona"],
            "persona_scores":   persona_result["scores"],
            "meal_times":       meal_times
        })


        return jsonify({
            "session_id":       session_id,
            "updated_schedule": updated_schedule,
            "meal_times":       meal_times,
            "summary":          summary
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# ENDPOINT 4: POST /log-event
# Called when user taps taken/missed/delayed on notification
# ─────────────────────────────────────────

@app.route("/log-event", methods=["POST"])
def log_event():
    """
    Input:
    {
        "session_id": str,
        "dose_id":        str,
        "drug_name":      str,
        "day":            int,
        "slot":           str,
        "scheduled_time": "HH:MM",
        "status":         "taken" | "missed" | "delayed",
        "actual_time":    "HH:MM" | null
    }

    Output:
    {
        "session_id": str,
        "event_logged": event_dict,
        "inferred_persona": str,
        "persona_confidence": float
    }
    """
    try:
        data       = request.get_json(force=True)
        session_id = data.get("session_id")

        if not session_id:
            return jsonify({"error": "session_id is required"}), 400

        event = create_real_event(
            dose_id        = data["dose_id"],
            drug_name      = data["drug_name"],
            day            = data["day"],
            slot           = data["slot"],
            scheduled_time = data["scheduled_time"],
            status         = data["status"],
            actual_time    = data.get("actual_time")
        )

        db.save_event(event, session_id)
        db.append_adherence(session_id, {
            "day":       event["day"],
            "drug_name": event["drug_name"],
            "status":    event["status"],
            "time":      event["scheduled_time"]
        })

        # re-infer persona with updated events
        all_events     = db.get_events(session_id)
        persona_result = infer_persona(all_events)

        db.update_state(session_id, {
            "inferred_persona": persona_result["persona"],
            "persona_scores":   persona_result["scores"]
        })

        return jsonify({
            "session_id":         session_id,
            "event_logged":       event,
            "inferred_persona":   persona_result["persona"],
            "persona_confidence": persona_result["confidence"],
            "persona_reasoning":  persona_result["reasoning"]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# ENDPOINT 5: GET /state
# React polls this for live updates
# ─────────────────────────────────────────

@app.route("/state", methods=["GET"])
def state():
    """
    Query param: ?session_id=xxx

    Output: full system state from MongoDB
    {
        session_id, meal_times, inferred_persona,
        persona_scores, adherence_history,
        active_drugs, total_doses, taken_doses
    }
    """
    try:
        session_id = request.args.get("session_id")
        if not session_id:
            return jsonify({"error": "session_id query param required"}), 400

        current_state    = db.get_state(session_id)
        current_schedule = db.get_schedule(session_id)
        events           = db.get_events(session_id)

        adherence = compute_adherence(events)

        return jsonify({
            **current_state,
            "schedule":  current_schedule,
            "adherence": adherence
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────
# NGROK + SERVER LAUNCH
# ─────────────────────────────────────────

def start_server(ngrok_token: str, port: int = 5050):
    """
    Call this from your Colab notebook cell:

        from server import start_server
        start_server(ngrok_token="YOUR_TOKEN_HERE")
    """
    ngrok.set_auth_token(ngrok_token)

    # kill any existing tunnels
    ngrok.kill()

    tunnel = ngrok.connect(port)
    public_url = tunnel.public_url
    print("=" * 50)
    print(f"  Agent API live at: {public_url}")
    print("  Share this URL with your teammate.")
    print("=" * 50)
    print(f"  Endpoints:")
    print(f"    POST {public_url}/schedule")
    print(f"    POST {public_url}/simulate")
    print(f"    POST {public_url}/replan")
    print(f"    POST {public_url}/log-event")
    print(f"    GET  {public_url}/state?session_id=xxx")
    print("=" * 50)

    app.run(host="0.0.0.0", port=port)


# ─────────────────────────────────────────
# DIRECT RUN (for local testing only)
# ─────────────────────────────────────────

if __name__ == "__main__":
    app.run(port=5050, debug=True)
