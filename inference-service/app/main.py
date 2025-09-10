from fastapi import FastAPI
from fastapi.responses import JSONResponse
from minio import Minio
from pydantic import BaseModel
from typing import Dict, List
from io import BytesIO
import random
import json
from app.config import settings
import os

app = FastAPI()

minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False
)

class ProcessedFilesRequest(BaseModel):
    packages: Dict[str, List[str]]

PARENT_CLASSES = [
    "Screwdriver",
    "Pliers",
    "Wrench",
    "Socket Wrench",
    "Digital Torque Wrench",
    "Voltage Tester",
    "Digital Caliper",
    "Drill Bit",
    "Electric Drill",
    "Tape Measure",
    "Flashlight",
    "Safety Glasses",
    "Safety Helmet",
    "Wirecutter",
    "Clamp",
    "Air Compressors",
    "Fire Extinguisher",
    "First AID Kit",
    "Metal Nut",
    "Bearing"
]

NAME_TO_ID = {name: idx for idx, name in enumerate(PARENT_CLASSES, start=1)}

MICROCLASSES = {
    1: ["Screwdriver - Philips, Red Handle, Bosch", "Screwdriver - Flat, Blue Handle, Makita"],
    2: ["Pliers - Needle Nose, Yellow Handle, Stanley", "Pliers - Slip Joint, Red Handle, Knipex"],
    3: ["Wrench - 10mm, Chrome, Beta", "Wrench - 15mm, Steel, Facom"],
    4: ["Socket Wrench - 1/2\", Drive, Black, Craftsman", "Socket Wrench - 3/8\", Drive, Chrome, Dewalt"],
    5: ["Digital Torque Wrench - 5-50 Nm, Metric, Snap-on", "Digital Torque Wrench - 20-200 Nm, Imperial, Tekton"],
    6: ["Voltage Tester - Non-contact, LCD Display, Fluke", "Voltage Tester - Contact, Analog, Klein"],
    7: ["Digital Caliper - 150mm, Metric/Imperial, Mitutoyo", "Digital Caliper - 200mm, Stainless Steel, Starrett"],
    8: ["Drill Bit - 6mm, Titanium, Bosch", "Drill Bit - 10mm, High-Speed Steel, Dewalt"],
    9: ["Electric Drill - 18V, Cordless, Black & Decker", "Electric Drill - 750W, Corded, Makita"],
    10: ["Tape Measure - 5m, 19mm Wide, Stanley", "Tape Measure - 8m, 25mm Wide, Komelon"],
    11: ["Flashlight - LED, 800 Lumens, Maglite", "Flashlight - Rechargeable, 500 Lumens, Fenix"],
    12: ["Safety Glasses - Clear Lens, Black Frame, 3M", "Safety Glasses - Tinted Lens, Blue Frame, Uvex"],
    13: ["Safety Helmet - Yellow, ABS, MSA", "Safety Helmet - White, Polycarbonate, Honeywell"],
    14: ["Wirecutter - Diagonal, Red Handle, Knipex", "Wirecutter - End Cutting, Blue Handle, Irwin"],
    15: ["Clamp - 100mm, Steel, Bessey", "Clamp - 200mm, Cast Iron, Irwin"],
    16: ["Air Compressors - 50L, 2HP, Stanley", "Air Compressors - 100L, 3HP, Makita"],
    17: ["Fire Extinguisher - ABC, 6kg, Kidde", "Fire Extinguisher - CO2, 5kg, Gloria"],
    18: ["First Aid Kit - 50 Pieces, Compact, Lifeline", "First Aid Kit - 100 Pieces, Large, Johnson & Johnson"],
    19: ["Metal Nut - M8, Stainless Steel, Hex", "Metal Nut - M10, Brass, Hex"],
    20: ["Bearing - 6202, Steel, SKF", "Bearing - 6304, Chrome, NSK"]
}

def extract_macroclass_from_key(key: str):
    filename = key.split("/")[-1]
    name_no_ext = filename.rsplit(".", 1)[0]
    macro_name = name_no_ext.rsplit("_", 1)[0]
    macro_id = NAME_TO_ID.get(macro_name)
    return macro_name, macro_id

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

@app.post("/classify")
async def classify(request: ProcessedFilesRequest):
    results = {}
    for raw_file, processed_files in request.packages.items():
        results[raw_file] = {}
        for p_file in processed_files:
            macro_name, macro_id = extract_macroclass_from_key(p_file)
            if macro_id and macro_id in MICROCLASSES:
                microclass = random.choice(MICROCLASSES[macro_id])
                confidence = round(random.uniform(0.5, 0.99), 2)
            else:
                microclass = "Unknown"
                confidence = 0.0
            result_entry = {
                "macroclass": macro_name,
                "macroclass_id": macro_id,
                "microclass": microclass,
                "confidence": confidence
            }
            results[raw_file][p_file] = result_entry

    first_raw = next(iter(request.packages))
    job_id = first_raw.split("/")[0] if "/" in first_raw else "default"
    save_results_json(job_id, results)
    return JSONResponse(content={"status": "ok", "results": results})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
