# AI Prescription Analyzer 🏥💊

A full-stack web application that extracts structured medical information from prescription images using a Multi-Agent AI pipeline.

## Architecture

```
Frontend (React + Tailwind) → Express Backend → Google Colab AI Pipeline (via ngrok)
```

## Quick Start

### 1. Install dependencies

```bash
# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

### 2. Configure the Colab API URL

Copy `.env.example` to `.env` and set your ngrok URL:

```bash
cp .env.example .env
# Edit .env and set COLAB_API_URL
```

### 3. Run the development servers

```bash
# From the root directory — runs both client & server
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## Project Structure

```
prescript_ai/
├── client/                 # React frontend (Vite + Tailwind)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── hooks/          # Custom React hooks
│       ├── App.jsx         # Main application
│       └── index.css       # Design system & animations
├── server/                 # Express backend
│   ├── routes/             # API routes
│   ├── middleware/         # Upload handling
│   └── index.js            # Server entry point
├── .env                    # Environment variables (not in git)
└── .env.example            # Template for env vars
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Node.js, Express |
| AI Pipeline | Google Colab (via ngrok) |

## License

For educational and research purposes only.
