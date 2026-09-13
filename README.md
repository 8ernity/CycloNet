# 🌀 CycloneTracker AI — Tropical Cyclone Tracking & Intensity Classification Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/Deep%20Learning-PyTorch%202.2-EE4C2C?style=for-the-badge&logo=pytorch)](https://pytorch.org/)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow?style=for-the-badge&logo=python)](https://www.python.org/)

**CycloneTracker AI** is an intelligent meteorological monitoring and analysis platform. It combines real-time geospatial tracking with deep learning inference to classify tropical cyclones and estimate intensity stages from satellite imagery based on the IMD (India Meteorological Department) and Dvorak scales.

---

## 🌟 Key Features

- 🛰️ **Deep Learning Intensity Classifier**:
  - Fine-tuned **ResNet-50 + Multi-Layer Perceptron Head** trained in PyTorch.
  - Generates dynamic, continuous softmax probabilities across 5 classes:
    - No Cyclone Detected (Non-Meteorological Image)
    - Cyclonic Storm (CS)
    - Severe Cyclonic Storm (SCS)
    - Very Severe Cyclonic Storm (VSCS)
    - Extremely Severe Cyclonic Storm (ESCS)
  - Out-of-distribution rejection for non-meteorological images.
  - Automatic estimation of **Dvorak T-Numbers** (T3.0 to T5.5+) and sustained wind speeds (knots).
- 🗺️ **Interactive Geospatial Dashboard**:
  - Live trajectory tracking of active tropical cyclones with real-time map rendering using Leaflet.
  - Multi-layer visualization: storm center, cone of uncertainty, wind radiuses, and historical waypoints.
- 📜 **Historical Storm Archive**:
  - Searchable and filterable archive of past major cyclones (Amphan, Tauktae, Biparjoy, etc.).
- 📊 **Alert Reports & PDF Export**:
  - Meteorological bulletins, danger-zone advisories, and instant report generation.
- 🌓 **Modern Dark / Light Interface**:
  - Glassmorphic UI with responsive desktop and mobile support, customizable themes, and real-time toast alerts.

---

## 🏗️ System Architecture

`	ext
CycloneTracker/
├── backend/
│   ├── app/
│   │   ├── api/routes.py              # FastAPI REST endpoints
│   │   ├── core/database.py           # SQLite & SQLAlchemy engine
│   │   ├── models/
│   │   │   ├── cyclone_classifier.pth # Trained PyTorch weights (~4.5 MB)
│   │   │   └── domain.py              # ORM database schemas
│   │   ├── services/
│   │   │   ├── ml_service.py          # PyTorch model inference & validation
│   │   │   └── data_ingestion.py      # Historical & real-time storm data
│   │   └── main.py                    # FastAPI application entrypoint
│   ├── train_classifier.py            # PyTorch training script with data augmentation
│   ├── test_api.py                    # Automated API test suite
│   └── requirements.txt               # Backend Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── classification/        # AI Satellite Classifier UI
│   │   │   ├── forecast/              # Storm Trajectory & Predictions
│   │   │   ├── archive/               # Historical Storm Database
│   │   │   ├── reports/               # Meteorological Bulletins & PDF Export
│   │   │   └── settings/              # Theme, Alerts, & Data Feeds
│   │   └── components/                # Reusable UI widgets, maps & navigation
│   ├── public/demo_frames/            # Curated INSAT-3DR satellite imagery
│   └── package.json                   # Frontend dependencies (Next.js, Lucide, Tailwind)
└── start_all.bat                      # One-click Windows startup script
`

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & 
pm

---

### Option 1: One-Click Launch (Windows)
Double-click start_all.bat or run:
`cmd
start_all.bat
`
This launches both the FastAPI backend on http://localhost:8000 and the Next.js frontend on http://localhost:3000.

---

### Option 2: Manual Setup

#### 1. Backend Setup
`ash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
`
Backend API docs will be available at: http://localhost:8000/docs

#### 2. Frontend Setup
`ash
cd frontend
npm install
npm run dev
`
Open your browser at: http://localhost:3000

---

## 📡 REST API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/cyclones | Returns all active cyclones and coordinates |
| GET | /api/cyclones/{id} | Detailed telemetry and track history for a specific storm |
| POST | /api/classify | Uploads satellite image; returns PyTorch intensity classification & probabilities |
| GET | /api/history/classifications | Fetches logged classification records from SQLite |

---

## 🧪 Model Training & Retraining

To retrain the PyTorch classifier head on additional satellite imagery:
`ash
cd backend
python train_classifier.py
`
The script applies 360° rotational invariance, flips, crops, and color jitter to augment satellite frames and exports the weights directly to ackend/app/models/cyclone_classifier.pth.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
