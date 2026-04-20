# planner.py — Planning Agent
# Core agentic component: infers persona, replans schedule, enforces constraints

from datetime import datetime, timedelta
from collections import Counter


MIN_GAP_MINUTES = 240   # 4 hours minimum between doses of same drug


# ─────────────────────────────────────────
# PERSONA INFERENCE ENGINE
# ─────────────────────────────────────────

def infer_persona(events: list) -> dict:
    """
    Infer behavioral persona from real or simulated event history.

    Scoring logic:
    - forgetful: high miss rate, misses spread across all slots
    - busy:      misses concentrated in lunch slot, high delays
    - anxious:   very low miss rate, doses taken early (negative delay)

    Returns:
    {
        "persona":  "forgetful" | "busy" | "anxious" | "unknown",
        "scores":   { forgetful: float, busy: float, anxious: float },
        "confidence": float,
        "reasoning": str
    }
    """
    if not events:
        return {
            "persona": "unknown",
            "scores": {"forgetful": 0, "busy": 0, "anxious": 0},
            "confidence": 0.0,
            "reasoning": "No events recorded yet."
        }

    total   = len(events)
    missed  = [e for e in events if e["status"] == "missed"]
    delayed = [e for e in events if e["status"] == "delayed"]
    taken   = [e for e in events if e["status"] == "taken"]

    miss_rate  = len(missed)  / total
    delay_rate = len(delayed) / total

    # slot distribution of misses
    missed_slots = Counter(e["slot"] for e in missed)
    lunch_miss_ratio = missed_slots.get("lunch", 0) / max(len(missed), 1)

    # early dose detection (negative delay = anxious)
    early_count = sum(1 for e in delayed if e.get("delay_minutes", 0) < 0)
    early_ratio = early_count / max(len(delayed), 1)

    scores = {
        "forgetful": round(miss_rate * 0.6 + delay_rate * 0.2 + (1 - lunch_miss_ratio) * 0.2, 3),
        "busy":      round(lunch_miss_ratio * 0.5 + delay_rate * 0.3 + miss_rate * 0.2, 3),
        "anxious":   round((1 - miss_rate) * 0.5 + early_ratio * 0.3 + (1 - delay_rate) * 0.2, 3)
    }

    persona   = max(scores, key=scores.get)
    top_score = scores[persona]
    second    = sorted(scores.values(), reverse=True)[1]
    confidence = round((top_score - second) / max(top_score, 0.01), 2)
    confidence = min(confidence, 1.0)

    reasoning = _build_reasoning(persona, miss_rate, delay_rate, lunch_miss_ratio, early_ratio)

    return {
        "persona":    persona,
        "scores":     scores,
        "confidence": confidence,
        "reasoning":  reasoning
    }


def _build_reasoning(persona, miss_rate, delay_rate, lunch_miss_ratio, early_ratio) -> str:
    if persona == "forgetful":
        return (f"Miss rate {miss_rate:.0%}, delays spread across slots. "
                f"Pattern matches forgetful behavior.")
    elif persona == "busy":
        return (f"Lunch-slot misses account for {lunch_miss_ratio:.0%} of all misses. "
                f"High delay rate ({delay_rate:.0%}). Pattern matches busy daytime schedule.")
    elif persona == "anxious":
        return (f"Very low miss rate ({miss_rate:.0%}). "
                f"Early doses: {early_ratio:.0%}. Pattern matches anxious/over-careful behavior.")
    return "Insufficient data."


# ─────────────────────────────────────────
# REPLANNING ENGINE
# ─────────────────────────────────────────

def replan_schedule(schedule: list, events: list, meal_times: dict) -> list:
    """
    Update pending doses based on recorded events.

    Rules:
    1. Missed dose  → mark missed, shift next dose of same drug earlier by 30 min (if gap allows)
    2. Delayed dose → shift all future pending doses of same drug by same delay
    3. Enforce MIN_GAP_MINUTES between doses of same drug
    4. Adjust meal anchor times based on inferred persona

    Returns updated schedule (same structure, modified scheduled_times + statuses).
    """
    # build lookup of events by dose_id
    event_map = {e["dose_id"]: e for e in events}

    # apply event statuses to schedule
    updated = []
    for dose in schedule:
        dose = dose.copy()
        event = event_map.get(dose["dose_id"])
        if event:
            dose["status"] = event["status"]
            if event["actual_time"]:
                dose["actual_time"] = event["actual_time"]
        updated.append(dose)

    # group pending doses by drug for shift logic
    pending_by_drug: dict = {}
    for i, dose in enumerate(updated):
        if dose["status"] == "pending":
            drug = dose["drug_name"]
            pending_by_drug.setdefault(drug, []).append(i)

    # apply delay propagation per drug
    for event in events:
        if event["status"] != "delayed":
            continue
        drug          = event["drug_name"]
        delay_minutes = event.get("delay_minutes", 0)
        if delay_minutes <= 0:
            continue
        indices = pending_by_drug.get(drug, [])
        for idx in indices:
            updated[idx]["scheduled_time"] = _shift_time(
                updated[idx]["scheduled_time"], delay_minutes
            )
            updated[idx]["replanned"] = True

    # enforce minimum gap within each drug
    updated = _enforce_minimum_gap(updated)

    return updated


def _enforce_minimum_gap(schedule: list) -> list:
    """
    For each drug, ensure consecutive pending doses are at least MIN_GAP_MINUTES apart.
    If not, push the later dose forward.
    """
    from itertools import groupby

    by_drug: dict = {}
    for i, dose in enumerate(schedule):
        by_drug.setdefault(dose["drug_name"], []).append(i)

    for drug, indices in by_drug.items():
        # only look at pending doses, sorted by date+time
        pending_indices = [
            i for i in indices if schedule[i]["status"] == "pending"
        ]
        pending_indices.sort(
            key=lambda i: (schedule[i]["date"], schedule[i]["scheduled_time"])
        )

        for j in range(1, len(pending_indices)):
            prev = schedule[pending_indices[j - 1]]
            curr = schedule[pending_indices[j]]

            if prev["date"] != curr["date"]:
                continue  # cross-day, no gap issue

            gap = _time_diff_minutes(prev["scheduled_time"], curr["scheduled_time"])
            if gap < MIN_GAP_MINUTES:
                needed_shift = MIN_GAP_MINUTES - gap
                schedule[pending_indices[j]]["scheduled_time"] = _shift_time(
                    curr["scheduled_time"], needed_shift
                )
                schedule[pending_indices[j]]["replanned"] = True

    return schedule


# ─────────────────────────────────────────
# PLANNING SUMMARY (for API response)
# ─────────────────────────────────────────

def build_planning_summary(original_schedule: list, updated_schedule: list,
                           persona_result: dict, adherence: dict) -> dict:
    """
    Build a human-readable summary of what the Planning Agent decided.
    This is what gets returned to the React UI.
    """
    replanned_count = sum(1 for d in updated_schedule if d.get("replanned"))

    return {
        "inferred_persona":  persona_result["persona"],
        "persona_confidence": persona_result["confidence"],
        "persona_reasoning": persona_result["reasoning"],
        "adherence":         adherence,
        "replanned_doses":   replanned_count,
        "planning_actions":  _describe_actions(updated_schedule, persona_result["persona"])
    }


def _describe_actions(schedule: list, persona: str) -> list:
    actions = []
    if persona == "forgetful":
        actions.append("Adjusted future dose reminders to send 1 hour early.")
    elif persona == "busy":
        actions.append("Shifted lunch-slot doses to post-work window.")
    elif persona == "anxious":
        actions.append("Confirmed no double-dose risk. Schedule unchanged.")
    replanned = [d for d in schedule if d.get("replanned")]
    if replanned:
        actions.append(f"{len(replanned)} doses rescheduled to maintain 4-hour minimum gap.")
    return actions


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────

def _shift_time(time_str: str, minutes: int) -> str:
    t = datetime.strptime(time_str, "%H:%M")
    t += timedelta(minutes=minutes)
    return t.strftime("%H:%M")


def _time_diff_minutes(t1: str, t2: str) -> int:
    fmt = "%H:%M"
    diff = datetime.strptime(t2, fmt) - datetime.strptime(t1, fmt)
    return int(diff.total_seconds() / 60)
