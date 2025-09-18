from fastapi import FastAPI
from fastapi.responses import JSONResponse
from minio import Minio
from pydantic import BaseModel
from typing import Dict, List
from io import BytesIO
import random
import json
import os
from PIL import Image

from app.config import settings
from model import ModelService

app = FastAPI()

minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False
)

class ProcessedFilesRequest(BaseModel):
    packages: Dict[str, List[str]]


MICROCLASSES = {
    1: ["Air Compressors - 50L, 2HP, Stanley", "Air Compressors - 100L, 3HP, Makita"],
    2: ["Bearing - 6202, Steel, SKF", "Bearing - 6304, Chrome, NSK"],
    3: ["Clamp - 100mm, Steel, Bessey", "Clamp - 200mm, Cast Iron, Irwin"],
    4: ["Digital Caliper - 150mm, Metric/Imperial, Mitutoyo", "Digital Caliper - 200mm, Stainless Steel, Starrett"],
    5: ["Digital Torque Wrench - 5-50 Nm, Metric, Snap-on", "Digital Torque Wrench - 20-200 Nm, Imperial, Tekton"],
    6: ["Drill Bit - 6mm, Titanium, Bosch", "Drill Bit - 10mm, High-Speed Steel, Dewalt"],
    7: ["Electric Drill - 18V, Cordless, Black & Decker", "Electric Drill - 750W, Corded, Makita"],
    8: ["Fire Extinguisher - ABC, 6kg, Kidde", "Fire Extinguisher - CO2, 5kg, Gloria"],
    9: ["First Aid Kit - 50 Pieces, Compact, Lifeline", "First Aid Kit - 100 Pieces, Large, Johnson & Johnson"],
    10: ["Flashlight - LED, 800 Lumens, Maglite", "Flashlight - Rechargeable, 500 Lumens, Fenix"],
    11: ["Metal Nut - M8, Stainless Steel, Hex", "Metal Nut - M10, Brass, Hex"],
    12: ["Pliers - Needle Nose, Yellow Handle, Stanley", "Pliers - Slip Joint, Red Handle, Knipex"],
    13: ["Safety Glasses - Clear Lens, Black Frame, 3M", "Safety Glasses - Tinted Lens, Blue Frame, Uvex"],
    14: ["Safety Helmet - Yellow, ABS, MSA", "Safety Helmet - White, Polycarbonate, Honeywell"],
    15: ["Screwdriver - Philips, Red Handle, Bosch", "Screwdriver - Flat, Blue Handle, Makita"],
    16: ["Socket Wrench - 1/2\", Drive, Black, Craftsman", "Socket Wrench - 3/8\", Drive, Chrome, Dewalt"],
    17: ["Tape Measure - 5m, 19mm Wide, Stanley", "Tape Measure - 8m, 25mm Wide, Komelon"],
    18: ["Voltage Tester - Non-contact, LCD Display, Fluke", "Voltage Tester - Contact, Analog, Klein"],
    19: ["Wirecutter - Diagonal, Red Handle, Knipex", "Wirecutter - End Cutting, Blue Handle, Irwin"],
    20: ["Wrench - 10mm, Chrome, Beta", "Wrench - 15mm, Steel, Facom"]
}

def save_results_json(job_id: str, data: dict):
    result_key = f"{job_id}/result.json"
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    stream = BytesIO(payload)
    minio_client.put_object(
        bucket_name="bucket-results",
        object_name=result_key,
        data=stream,
        length=len(payload),
        content_type="application/json"
    )

def get_image_from_minio(bucket: str, object_name: str) -> Image.Image:
    resp = None
    try:
        resp = minio_client.get_object(bucket, object_name)
        data = resp.read()
        img = Image.open(BytesIO(data))
        return img
    finally:
        if resp is not None:
            resp.close()
            resp.release_conn()

def extract_job_id_from_key(key: str) -> str:
    return key.split("/")[0] if "-" in key else "default"


@app.on_event("startup")
def load_model_on_startup():
    model_dir = "model"
    weights_path = os.path.join(model_dir, "best_resnet_model.pth")
    classes_order_path = os.path.join(model_dir, "class_to_idx.json")
    classes_txt_path = os.path.join(model_dir, "classes.txt")

    app.state.model_service = ModelService(
        weights_path=weights_path,
        classes_order_path=classes_order_path if os.path.exists(classes_order_path) else None,
        fallback_classes_txt=classes_txt_path if os.path.exists(classes_txt_path) else None,
    )
    print("Модель успешно загружена и готова к работе")


@app.post("/classify")
async def classify(request: ProcessedFilesRequest):
    results = {}
    input_bucket = getattr(settings, "minio_bucket_processed")
    raw_bucket = getattr(settings, "minio_bucket_raw")
    model_service: ModelService = app.state.model_service

    for raw_file, processed_files in request.packages.items():
        results[raw_file] = {}
        for p_file in processed_files:
            try:
                resp = minio_client.get_object(input_bucket, p_file)
                data = resp.read()
                resp.close()
                resp.release_conn()
                meta = json.loads(data.decode("utf-8"))

                source_key = meta["source_image_key"]
                bbox = meta["bbox"]

                img = get_image_from_minio(raw_bucket, source_key)
                cropped = img.crop((bbox[0], bbox[1], bbox[2], bbox[3]))

                macro_name, macro_id, conf = model_service.predict_pil(cropped)
                micro_candidates = MICROCLASSES.get(macro_id, None)
                if micro_candidates:
                    microclass = random.choice(micro_candidates)
                else:
                    microclass = "Unknown"

                result_entry = {
                    "macroclass": macro_name,
                    "macroclass_id": macro_id,
                    "microclass": microclass,
                    "confidence": round(conf, 4)
                }
            except Exception as e:
                result_entry = {
                    "macroclass": "Unknown",
                    "macroclass_id": None,
                    "microclass": "Unknown",
                    "confidence": 0.0,
                    "error": str(e)
                }

            results[raw_file][p_file] = result_entry

    first_raw = next(iter(request.packages))
    job_id = extract_job_id_from_key(first_raw)
    save_results_json(job_id, results)
    return JSONResponse(content={"status": "ok", "results": results})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)