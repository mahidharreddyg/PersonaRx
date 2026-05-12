# simulator.py — Simulation Agent
# Generates probabilistic dose events per persona
# Also used to produce demo data before real user interactions begin

import random
from datetime import datetime, timedelta


# ─────────────────────────────────────────
# PERSONA DEFINITIONS
# ─────────────────────────────────────────

PERSONAS = {
    "forgetful": {
        "miss_prob":         0.30,
        "delay_prob":        0.25,
        "max_delay_minutes": 90,
        "max_consecutive_misses": 2,
        # slot-specific miss probability multipliers
        "slot_weights": {"breakfast": 1.0, "lunch": 1.4, "dinner": 1.2}
    },
    "busy": {
        "miss_prob":         0.20,
        "delay_prob":        0.35,
        "max_delay_minutes": 120,
        "max_consecutive_misses": 1,
        # busy during daytime
        "slot_weights": {"breakfast": 0.5, "lunch": 1.8, "dinner": 0.8}
    },
    "anxious": {
        "miss_prob":         0.05,
        "delay_prob":        0.10,
        "max_delay_minutes": 20,
        "max_consecutive_misses": 0,
        # anxious users are early — negative delay (early dose)
        "slot_weights": {"breakfast": 0.8, "lunch": 0.9, "dinner": 0.8}
    }
}


# ─────────────────────────────────────────
# CORE SIMULATOR
# ─────────────────────────────────────────

def simulate_schedule(schedule: list, persona: str = "forgetful") -> list:
    """
    Given a schedule and a persona, generate a simulated event for every dose.

    Returns list of event dicts:
    {
        "dose_id":         str,
        "drug_name":       str,
        "day":             int,
        "slot":            str,
        "scheduled_time":  "HH:MM",
        "status":          "taken" | "missed" | "delayed",
        "actual_time":     "HH:MM" | None,
        "delay_minutes":   int,
        "timestamp":       ISO str,
        "source":          "simulation"
    }
    """
    config = PERSONAS.get(persona, PERSONAS["forgetful"])
    events = []
    consecutive_misses = 0

    for dose in schedule:
        slot        = dose.get("slot", "breakfast")
        weight      = config["slot_weights"].get(slot, 1.0)
        miss_prob   = min(config["miss_prob"] * weight, 0.95)
        delay_prob  = config["delay_prob"]

        # enforce consecutive miss cap
        if consecutive_misses >= config["max_consecutive_misses"] and config["max_consecutive_misses"] > 0:
            miss_prob = 0.0

        roll = random.random()

        if roll < miss_prob:
            status       = "missed"
            actual_time  = None
            delay_minutes = 0
            consecutive_misses += 1

        elif roll < miss_prob + delay_prob:
            status = "delayed"
            if persona == "anxious":
                # anxious users dose EARLY
                delay_minutes = -random.randint(5, 15)
            else:
                delay_minutes = random.randint(15, config["max_delay_minutes"])
            actual_time = _shift_time(dose["scheduled_time"], delay_minutes)
            consecutive_misses = 0

        else:
            status        = "taken"
            delay_minutes = random.randint(-5, 5)   # slight natural variance
            actual_time   = _shift_time(dose["scheduled_time"], delay_minutes)
            consecutive_misses = 0

        events.append({
            "dose_id":        dose["dose_id"],
            "drug_name":      dose["drug_name"],
            "day":            dose["day"],
            "slot":           slot,
            "scheduled_time": dose["scheduled_time"],
            "status":         status,
            "actual_time":    actual_time,
            "delay_minutes":  delay_minutes,
            "timestamp":      datetime.utcnow().isoformat(),
            "source":         "simulation"
        })

    return events


# ─────────────────────────────────────────
# ADHERENCE SUMMARY
# ─────────────────────────────────────────

def compute_adherence(events: list) -> dict:
    """
    Compute adherence stats from a list of events.
    Returns { score: float, taken: int, missed: int, delayed: int, total: int }
    """
    total   = len(events)
    taken   = sum(1 for e in events if e["status"] == "taken")
    missed  = sum(1 for e in events if e["status"] == "missed")
    delayed = sum(1 for e in events if e["status"] == "delayed")

    score = round((taken + 0.5 * delayed) / total, 2) if total > 0 else 0.0

    return {
        "score":   score,
        "taken":   taken,
        "missed":  missed,
        "delayed": delayed,
        "total":   total,
        "percent": f"{int(score * 100)}%"
    }


# ─────────────────────────────────────────
# SINGLE REAL EVENT (from user notification tap)
# ─────────────────────────────────────────

def create_real_event(dose_id: str, drug_name: str, day: int, slot: str,
                      scheduled_time: str, status: str, actual_time: str = None) -> dict:
    """
    Build a real (user-triggered) event when user taps taken/missed/delayed.
    """
    delay_minutes = 0
    if actual_time and status == "delayed":
        delay_minutes = _time_diff_minutes(scheduled_time, actual_time)

    return {
        "dose_id":        dose_id,
        "drug_name":      drug_name,
        "day":            day,
        "slot":           slot,
        "scheduled_time": scheduled_time,
        "status":         status,
        "actual_time":    actual_time,
        "delay_minutes":  delay_minutes,
        "timestamp":      datetime.utcnow().isoformat(),
        "source":         "user"
    }


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
