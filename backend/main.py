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
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "rice-dataset-mjw6b-yby29/2")
ROBOFLOW_DETECT_BASE_URL = "https://detect.roboflow.com"
session = requests.Session()

class AnalysisResult(BaseModel):
    total_grains: int
    whole_grains: int
    broken_grains: int
    broken_percentage: float
    avg_model_confidence: float
    processed_image: str

def decode_image(image_bytes: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

def resize_image_for_roboflow(image_bytes: bytes, max_long_side: int = 1280) -> bytes:
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image")

    h, w = img.shape[:2]
    if max(h, w) <= max_long_side:
        return image_bytes

    scale = max_long_side / max(h, w)
    img = cv2.resize(img, (int(w * scale), int(h * scale)))
    ok, buf = cv2.imencode(".jpg", img)
    if not ok:
        raise ValueError("Failed to encode image")
    return buf.tobytes()

def draw_boxes(img: np.ndarray, detections):
    out = img.copy()
    for d in detections:
        x1, y1, x2, y2 = map(int, d["bbox"])
        color = (0, 255, 0) if d["class"] == "whole_grain" else (255, 0, 0)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
    return out

def roboflow_infer(image_bytes: bytes, w: int, h: int):
    if not ROBOFLOW_API_KEY:
        raise HTTPException(status_code=503, detail="Roboflow API key missing")

    resized = resize_image_for_roboflow(image_bytes)
    encoded = base64.b64encode(resized).decode()

    response = session.post(
        f"{ROBOFLOW_DETECT_BASE_URL}/{ROBOFLOW_MODEL_ID}",
        params={"api_key": ROBOFLOW_API_KEY},
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Roboflow error {response.status_code}: {(response.text or '')[:200]}",
        )

    predictions = response.json().get("predictions", [])

    broken_scores, whole_scores = [], []
    for p in predictions:
        cls = p.get("class")
        conf = float(p.get("confidence", 0.0))
        if cls in ("broken", "broken_grain"):
            broken_scores.append(conf)
        elif cls in ("whole", "whole_grain", "full"):
            whole_scores.append(conf)

    avg_broken = np.mean(broken_scores) if broken_scores else 0.0
    avg_whole = np.mean(whole_scores) if whole_scores else 0.0

    broken_min = avg_broken * 0.75
    whole_min = avg_whole * 0.75

    detections = []
    counts = {"whole_grain": 0, "broken_grain": 0}
    confs = []

    for p in predictions:
        cls = p.get("class")
        conf = float(p.get("confidence", 0.0))

        if cls in ("broken", "broken_grain"):
            if conf < broken_min:
                continue
            cls = "broken_grain"
        elif cls in ("whole", "whole_grain", "full"):
            if conf < whole_min:
                continue
            cls = "whole_grain"
        else:
            continue

        x, y = float(p["x"]), float(p["y"])
        bw, bh = float(p["width"]), float(p["height"])

        detections.append(
            {
                "class": cls,
                "confidence": round(conf, 3),
                "bbox": [
                    max(0, x - bw / 2),
                    max(0, y - bh / 2),
                    min(w, x + bw / 2),
                    min(h, y + bh / 2),
                ],
            }
        )

        counts[cls] += 1
        confs.append(conf)

    return detections, counts, float(np.mean(confs)) if confs else 0.0

@app.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    rgb = decode_image(image_bytes)
    h, w = rgb.shape[:2]

    detections, counts, avg_conf = roboflow_infer(image_bytes, w, h)

    total = counts["whole_grain"] + counts["broken_grain"]
    broken_pct = (counts["broken_grain"] / total) * 100 if total else 0

    annotated = draw_boxes(rgb, detections)
    _, buf = cv2.imencode(".jpg", cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR))

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
    return {"roboflow_configured": bool(ROBOFLOW_API_KEY)}

frontend_path = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
