from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import json
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
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID", "detect-and-classify")
ROBOFLOW_WORKSPACE = os.getenv("ROBOFLOW_WORKSPACE", "your-workspace")  # User needs to set this
ROBOFLOW_SERVERLESS_URL = f"https://serverless.roboflow.com/{ROBOFLOW_WORKSPACE}/workflows"
session = requests.Session()

def _normalize_workflow_id(value: str) -> str:
    v = (value or "").strip()
    if not v:
        return v

    if "/" in v:
        v = v.rstrip("/").split("/")[-1]

    if v.count(".") >= 2:
        try:
            payload_b64 = v.split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
            workflow_id = payload.get("workflowId")
            if isinstance(workflow_id, str) and workflow_id.strip():
                return workflow_id.strip()
        except Exception:
            return v

    return v

ROBOFLOW_WORKFLOW_ID = _normalize_workflow_id(ROBOFLOW_MODEL_ID)

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
    if not ROBOFLOW_WORKFLOW_ID or ROBOFLOW_WORKFLOW_ID == "your-workspace":
        raise HTTPException(status_code=503, detail="Roboflow workspace or workflow ID missing")

    resized = resize_image_for_roboflow(image_bytes)
    encoded = base64.b64encode(resized).decode()

    workflow_url = f"{ROBOFLOW_SERVERLESS_URL}/{ROBOFLOW_WORKFLOW_ID}"
    
    response = session.post(
        workflow_url,
        json={
            "api_key": ROBOFLOW_API_KEY,
            "inputs": {
                "image": encoded
            }
        },
        timeout=90,
    )

    if not response.ok:
        raise HTTPException(
            status_code=502,
            detail=f"Roboflow failed ({response.status_code}): {response.text[:300]}"
        )

    result = response.json()
    
    # Serverless workflow API returns outputs array
    outputs = result.get("outputs", [])
    if not outputs:
        predictions = []
    else:
        # Get predictions from the first output
        first_output = outputs[0]
        predictions = first_output.get("predictions", [])

    detections = []
    counts = {"whole_grain": 0, "broken_grain": 0}
    confs = []

    for p in predictions:
        cls = p.get("class")
        conf = float(p.get("confidence", 0.0))

        if cls not in counts:
            continue

        x, y, bw, bh = map(float, (p["x"], p["y"], p["width"], p["height"]))

        detections.append({
            "class": cls,
            "confidence": round(conf, 3),
            "bbox": [
                max(0, x - bw / 2),
                max(0, y - bh / 2),
                min(w, x + bw / 2),
                min(h, y + bh / 2),
            ],
        })

        counts[cls] += 1
        confs.append(conf)

    return detections, counts, float(np.mean(confs)) if confs else 0.0

@app.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    resized = resize_image_for_roboflow(image_bytes)
    rgb = decode_image(resized)
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
    return {
        "roboflow_configured": bool(ROBOFLOW_API_KEY),
        "workspace_configured": ROBOFLOW_WORKSPACE != "your-workspace",
        "workflow_id": ROBOFLOW_WORKFLOW_ID
    }

frontend_path = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
