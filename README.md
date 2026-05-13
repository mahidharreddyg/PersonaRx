# PersonaRx
### A Multi-Agent Framework for Adaptive Prescription Planning Using Persona-Driven Behavioral Simulation

Most medication reminder apps are just fixed alarms. **PersonaRx** watches how you behave with your schedule, figures out what kind of patient you are, and automatically adjusts your future dose times to fit your life.

---

## 🚀 Features

* 📄 Upload a printed prescription and have it parsed automatically
* ✏️ Review and correct extracted fields before confirming
* 🔔 Browser push notifications with Taken / Missed action buttons
* 🤖 Simulate realistic patient behaviour across three behavioural personas
* 🧠 AI Planning Agent infers your persona and replans your schedule in real time
* 🔒 Hard pharmacological safety constraint -> no two doses ever less than four hours apart
* 👤 JWT-authenticated accounts with session-isolated data

---

## 🏗️ System Pipeline

1. Upload prescription image
2. OCR extracts drug name, dosage, frequency, duration and food constraint
3. User reviews and confirms extracted data
4. Scheduling Agent generates a meal-anchored dose timeline
5. Simulation Agent models patient behaviour across chosen persona
6. Planning Agent infers persona from event history and replans future doses
7. Updated schedule is pushed to the UI and notifications are rescheduled

---

## 🤖 The Four Agents

* **Extraction Agent** — Runs Tesseract OCR and regex on the prescription image to produce structured medication JSON
* **Scheduling Agent** (`scheduler.py`) — Converts frequency patterns like `1-0-1` into a concrete dated dose timeline anchored to meal times
* **Simulation Agent** (`simulator.py`) — Generates realistic synthetic adherence data using probability distributions tuned to three behavioural personas
* **Planning Agent** (`planner.py`) — Infers which persona best fits the user's behaviour and replans future doses while enforcing the minimum gap safety constraint

---

## 🧪 Technologies Used

* React 19 + Vite + Tailwind CSS v4
* Web Push API + Service Worker (PWA)
* Node.js + Express.js + JWT + Mongoose
* Python + Flask + Tesseract OCR + OpenCV
* MongoDB Atlas
* Google Colab + ngrok

---

## 📂 Project Structure

```
prescript_ai/
├── client/          # React PWA frontend
├── server/          # Node.js Express backend + auth + DB models
└── agents/          # Python AI layer (Google Colab)
    ├── server.py    # Flask API bridge
    ├── scheduler.py # Scheduling Agent
    ├── simulator.py # Simulation Agent
    ├── planner.py   # Planning + Persona Inference Agent
    └── db.py        # MongoDB Atlas 
```

---

## ⚠️ Notes

* The AI layer runs on Google Colab with an ngrok tunnel. Update `COLAB_API_URL` in your `.env` each time you restart the notebook
* MongoDB credentials, JWT secret and ngrok token are not included. Configure your own `.env`
* Only digitally printed prescriptions are supported. Handwritten prescriptions are out of scope
* All evaluation used synthetic data from the Simulation Agent. They are not validated with real patients
* Designed for academic and research use only. Not intended for clinical deployment

---

## 👤 Authors 

* Mahidhar Reddy G
* A S Pradnya
