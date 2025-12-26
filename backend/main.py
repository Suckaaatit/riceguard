from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import requests
import os
from pathlib import Path

app = FastAPI(title="RiceGuard AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_MODEL_ID = "rice-dataset-mjw6b-yby29/2"
ROBOFLOW_URL = f"https://detect.roboflow.com/{ROBOFLOW_MODEL_ID}"

class AnalysisResult(BaseModel):
    total_grains: int
    whole_grains: int
    broken_grains: int
    broken_percentage: float
    avg_model_confidence: float
    processed_image: str

def decode_image(image_bytes):
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image")
    return img

def resize_image_for_roboflow(img, max_long_side: int = 1280):
    h, w = img.shape[:2]
    if max(h, w) <= max_long_side:
        return img

    scale = max_long_side / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h))

def draw_boxes(img, detections):
    for d in detections:
        x1, y1, x2, y2 = map(int, d["bbox"])
        color = (0, 255, 0) if d["class"] == "whole_grain" else (0, 0, 255)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
    return img

def roboflow_infer(image_bytes, w, h):
    if not ROBOFLOW_API_KEY:
        raise HTTPException(status_code=503, detail="Roboflow API key not configured")

    encoded = base64.b64encode(image_bytes).decode()

    res = requests.post(
        ROBOFLOW_URL,
        params={"api_key": ROBOFLOW_API_KEY},
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )

    if not res.ok:
        raise HTTPException(status_code=502, detail=res.text)

    preds = res.json().get("predictions", [])

    detections = []
    counts = {"whole_grain": 0, "broken_grain": 0}
    confs = []

    for p in preds:
        cls = p["class"]
        if cls not in counts:
            continue

        confs.append(float(p.get("confidence", 0.0)))

        counts[cls] += 1

        x, y, bw, bh = p["x"], p["y"], p["width"], p["height"]

        detections.append({
            "class": cls,
            "bbox": [
                max(0, x - bw / 2),
                max(0, y - bh / 2),
                min(w, x + bw / 2),
                min(h, y + bh / 2),
            ],
        })

    avg_conf = float(np.mean(confs)) if confs else 0.0
    return detections, counts, avg_conf

@app.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    img = decode_image(image_bytes)

    img = resize_image_for_roboflow(img, max_long_side=1280)
    h, w = img.shape[:2]

    ok, buf_for_rf = cv2.imencode(".jpg", img)
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to encode image")

    detections, counts, avg_conf = roboflow_infer(buf_for_rf.tobytes(), w, h)

    total = counts["whole_grain"] + counts["broken_grain"]
    broken_pct = (counts["broken_grain"] / total) * 100 if total else 0

    annotated = draw_boxes(img, detections)
    _, buf = cv2.imencode(".jpg", annotated)

    return AnalysisResult(
        total_grains=total,
        whole_grains=counts["whole_grain"],
        broken_grains=counts["broken_grain"],
        broken_percentage=round(broken_pct, 2),
        avg_model_confidence=round(avg_conf, 3),
        processed_image=base64.b64encode(buf).decode(),
    )

@app.get("/health")
def health():
    return {"status": "ok"}

frontend_path = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
