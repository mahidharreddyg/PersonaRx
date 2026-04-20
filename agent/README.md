# Agent Files

This folder contains the Python AI agent modules for PrescriptAI.

## Files
| File | Purpose |
|---|---|
| `db.py` | MongoDB Atlas interface — all persistence logic |
| `scheduler.py` | Scheduling Agent — converts 1-0-1 patterns to a timed dose schedule |
| `planner.py` | Planning Agent — infers user persona and replans schedule |
| `simulator.py` | Simulation Agent — generates fake dose events for testing |
| `server.py` | Main Flask server — wires everything together and exposes API endpoints |

## Setup (in Google Colab)
```python
import os
os.environ["MONGO_URI"] = "mongodb+srv://PersonaRX_Admin:Pradnya05Mahi03@cluster0.rqpaegu.mongodb.net/?appName=Cluster0"
```

## API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/schedule` | Generate and save a new medication schedule |
| `POST` | `/simulate` | Simulate dose events using a persona |
| `POST` | `/replan` | Replan schedule based on event history |
| `POST` | `/log-event` | Log a real user dose event |
| `GET` | `/state?session_id=xxx` | Get the current state for a session |
