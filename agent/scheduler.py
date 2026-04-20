# scheduler.py — Scheduling Agent
# Input:  validated_data (list of drug dicts using 1-0-1 format)
# Output: flat list of dose dicts with day + time + drug info

from datetime import datetime, timedelta


# ─────────────────────────────────────────
# MEAL TIME RESOLVER
# ─────────────────────────────────────────

def resolve_dose_times(pattern: str, meal_times: dict) -> list:
    """
    Map a 1-0-1 style pattern to actual HH:MM times.

    pattern: "M-A-N" where each position is 0 or 1
      M = morning (breakfast)
      A = afternoon (lunch)
      N = night (dinner)

    Returns list of { "slot": "breakfast"|"lunch"|"dinner", "time": "HH:MM" }
    """
    parts = pattern.strip().split("-")
    if len(parts) != 3:
        # fallback: once daily at breakfast
        parts = ["1", "0", "0"]

    slots = ["breakfast", "lunch", "dinner"]
    times = []

    for i, val in enumerate(parts):
        if val.strip() == "1":
            times.append({
                "slot": slots[i],
                "time": meal_times.get(slots[i], ["08:00", "14:00", "20:00"][i])
            })

    return times


# ─────────────────────────────────────────
# CORE SCHEDULING AGENT
# ─────────────────────────────────────────

def generate_schedule(validated_data: list, meal_times: dict = None, start_date: str = None) -> list:
    """
    Generate a full multi-day schedule from validated prescription JSON.

    validated_data: list of dicts from teammate's extraction agent
    {
        "drug": str,
        "dosage": str,
        "frequency": "1-0-1" | "1-1-1" | etc,
        "duration": "3 days" | "5 days",
        "constraint": "before food" | "after food" | null
    }

    Returns list of:
    {
        "dose_id": str,           # unique ID per dose
        "drug_name": str,
        "dosage": str,
        "day": int,               # 1-indexed
        "date": "YYYY-MM-DD",
        "slot": "breakfast" | "lunch" | "dinner",
        "scheduled_time": "HH:MM",
        "constraint": str,
        "status": "pending"
    }
    """
    if meal_times is None:
        meal_times = {"breakfast": "08:00", "lunch": "14:00", "dinner": "20:00"}

    if start_date is None:
        start_date = datetime.today().strftime("%Y-%m-%d")

    base_date = datetime.strptime(start_date, "%Y-%m-%d")
    schedule = []
    dose_counter = 0

    for drug in validated_data:
        drug_name  = drug.get("drug", "Unknown Drug")
        dosage     = drug.get("dosage", "")
        pattern    = drug.get("frequency", "1-0-0")
        constraint = drug.get("constraint") or "any"

        # parse duration
        duration_str = drug.get("duration", "1 days")
        try:
            duration_days = int(''.join(filter(str.isdigit, duration_str)))
        except Exception:
            duration_days = 1

        dose_times = resolve_dose_times(pattern, meal_times)

        for day_offset in range(duration_days):
            day_num  = day_offset + 1
            day_date = (base_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")

            for dose in dose_times:
                dose_counter += 1
                dose_id = f"{drug_name.replace(' ', '_')}_D{day_num}_{dose['slot']}"

                schedule.append({
                    "dose_id":         dose_id,
                    "drug_name":       drug_name,
                    "dosage":          dosage,
                    "day":             day_num,
                    "date":            day_date,
                    "slot":            dose["slot"],
                    "scheduled_time":  dose["time"],
                    "constraint":      constraint,
                    "status":          "pending"
                })

    # sort by date then time
    schedule.sort(key=lambda x: (x["date"], x["scheduled_time"]))
    return schedule


# ─────────────────────────────────────────
# MEAL TIME ADJUSTER (called by Planning Agent)
# ─────────────────────────────────────────

def adjust_meal_times(current_meal_times: dict, persona: str) -> dict:
    """
    Shift meal times based on inferred persona.
    Called by the Planning Agent after persona is inferred.

    Returns updated meal_times dict.
    """
    updated = current_meal_times.copy()

    def shift(time_str: str, minutes: int) -> str:
        t = datetime.strptime(time_str, "%H:%M")
        t += timedelta(minutes=minutes)
        return t.strftime("%H:%M")

    if persona == "forgetful":
        # push all times 30 min later — forgetful users tend to be late
        updated["breakfast"] = shift(updated["breakfast"], +30)
        updated["lunch"]     = shift(updated["lunch"],     +30)
        updated["dinner"]    = shift(updated["dinner"],    +30)

    elif persona == "busy":
        # compress lunch window, shift dinner later (busy during day)
        updated["lunch"]  = shift(updated["lunch"],  +60)
        updated["dinner"] = shift(updated["dinner"], +30)

    elif persona == "anxious":
        # pull all times 15 min earlier — anxious users dose early
        updated["breakfast"] = shift(updated["breakfast"], -15)
        updated["lunch"]     = shift(updated["lunch"],     -15)
        updated["dinner"]    = shift(updated["dinner"],    -15)

    return updated
