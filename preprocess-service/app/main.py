from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from minio import Minio
import imageio.v3 as iio
from app.config import settings
from io import BytesIO
from PIL import Image
import cv2
import os
import random
import torch
import json
from datetime import datetime
from ultralytics import YOLO

app = FastAPI()

MODEL_PATH = 'model/best.pt'
yolo_model = YOLO(MODEL_PATH)

minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False
)

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


@app.post("/preprocess")
async def preprocess(key: str = Query(..., description="Ключ файла в Minio")):
    bucket_raw = settings.minio_bucket_raw
    bucket_processed = settings.minio_bucket_processed
    try:
        response = minio_client.get_object(bucket_raw, key)
        file_data = response.read()
        response.close()
        response.release_conn()

        preprocess_results = {}
        sizes = []

        filename = key.split("/")[-1]
        job_id = key.split("/")[0]
        name, ext = os.path.splitext(filename)
        ext = ext.lower()

        if ext in [".jpg", ".jpeg", ".png"]:
            img = Image.open(BytesIO(file_data)).convert('RGB')
            results = yolo_model(img)

            if len(results[0].boxes) == 0:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "status": "no_detections",
                        "message": "Model didn't detect any known tool in the image.",
                    }
                )

            for i, box in enumerate(results[0].boxes):
                class_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = [float(x) for x in box.xyxy[0].tolist()]
                macro_class = yolo_model.names[class_id]

                detection_obj = {
                    "source_image_key": key,
                    "object_key": f"{job_id}/{name}/{macro_class}_{i}.json",
                    "class_id": class_id,
                    "macro_class": macro_class,
                    "confidence": conf,
                    "bbox": xyxy,
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                }

                data_bytes = json.dumps(detection_obj, ensure_ascii=False).encode("utf-8")
                object_key = detection_obj["object_key"]

                minio_client.put_object(
                    bucket_name=bucket_processed,
                    object_name=object_key,
                    data=BytesIO(data_bytes),
                    length=len(data_bytes),
                    content_type="application/json"
                )

                preprocess_results[f"{macro_class}_{i}"] = {
                    "object_key": object_key,
                    "confidence": conf,
                    "bbox": xyxy
                }
                sizes.append(f"{len(data_bytes) // 1024}KB")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

    return JSONResponse(content={
        "status": "ok",
        "preprocessResults": preprocess_results,
        "size": sizes,
        "message": "Processed successfully"
    })


@app.post("/video/cut")
async def video_preprocess(key: str = Query(..., description="Ключ видео в Minio")):
    bucket_raw = settings.minio_bucket_raw
    bucket_processed = settings.minio_bucket_processed
    try:
        response = minio_client.get_object(bucket_raw, key)
        file_data = response.read()
        response.close()
        response.release_conn()

        preprocess_results = {}
        sizes = []

        filename = key.split("/")[-1]
        job_id = key.split("/")[0]
        name, ext = os.path.splitext(filename)

        if ext.lower() != ".mp4":
            raise HTTPException(status_code=400, detail="Not an mp4 file")

        frames = list(iio.imiter(file_data, extension=".mp4"))
        total_frames = len(frames)
        if total_frames == 0:
            raise HTTPException(status_code=400, detail="Video has no frames")

        num_frames = min(3, total_frames)
        frame_indices = random.sample(range(total_frames), num_frames)

        for idx, frame_idx in enumerate(frame_indices):
            frame = frames[frame_idx]

            img = Image.fromarray(frame).transpose(Image.FLIP_TOP_BOTTOM)
            img_resized = img.resize((640, 640))
            buffer = BytesIO()
            img_resized.save(buffer, format="JPEG")
            buffer.seek(0)
            data_bytes = buffer.getvalue()

            object_key = f"{job_id}/{name}/frame{idx}.jpg"
            minio_client.put_object(
                bucket_name=bucket_raw,
                object_name=object_key,
                data=BytesIO(data_bytes),
                length=len(data_bytes),
                content_type="image/jpeg"
            )


            preprocess_results[f"frame_{idx}"] = object_key
            sizes.append(f"{len(data_bytes) // 1024}KB")

    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

    return JSONResponse(content={
        "status": "ok",
        "preprocessResults": preprocess_results,
        "size": sizes,
        "message": "Video split into frames successfully"
    })