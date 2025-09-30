from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from minio import Minio
import imageio.v3 as iio
from app.SeekableMinioStream import SeekableMinioStream
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
import av

app = FastAPI()

MODEL_PATH = 'model/best.pt'
yolo_model = YOLO(MODEL_PATH)

minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False
)

@app.post("/recognize")
async def recognize(key: str = Query(..., description="Ключ файла в Minio")):
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
            results = yolo_model(img, conf=0.5, iou=0.5)

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
                micro_class = yolo_model.names[class_id]
                base_key = os.path.splitext(key)[0]
                object_key = f"{base_key}/{micro_class}_{i}.json"

                detection_obj = {
                    "source_image_key": key,
                    "object_key": object_key,
                    "class_id": class_id,
                    "micro_class": micro_class,
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

                preprocess_results[object_key] = {
                    "microClass": micro_class,
                    "confidence": conf,
                    "bbox": xyxy,
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
        "results": preprocess_results,
        "size": sizes,
        "message": "Processed successfully"
    })


@app.post("/video/cut")
async def video_preprocess(key: str = Query(..., description="Ключ видео в Minio")):
    bucket_raw = settings.minio_bucket_raw

    try:
        response = minio_client.get_object(bucket_raw, key)
        stream = SeekableMinioStream(response)

        job_id = key.split("/")[0]
        filename = os.path.basename(key)
        name, ext = os.path.splitext(filename)

        if ext.lower() != ".mp4":
            raise HTTPException(status_code=400, detail="Not an mp4 file")

        container = av.open(stream)
        video_stream = container.streams.video[0]

        total_frames = int(video_stream.frames or 0)
        if total_frames == 0:
            raise HTTPException(status_code=400, detail="Video has no frames")

        num_frames = min(3, total_frames)
        frame_indices = sorted(random.sample(range(total_frames), num_frames))
        preprocess_results = {}
        sizes = []

        for idx, target in enumerate(frame_indices):
            container.seek(int(target / video_stream.average_rate * av.time_base))
            frame = next(container.decode(video_stream))
            buffer = BytesIO()
            frame.to_image().save(buffer, format="JPEG", quality=95)
            buffer.seek(0)

            object_key = f"{job_id}/{name}/frame{idx}.jpg"
            minio_client.put_object(
                bucket_name=bucket_raw,
                object_name=object_key,
                data=buffer,
                length=buffer.getbuffer().nbytes,
                content_type="image/jpeg"
            )

            preprocess_results[f"frame_{idx}"] = object_key
            sizes.append(f"{buffer.getbuffer().nbytes // 1024}KB")
            buffer.close()

        container.close()
        response.close()

    except Exception as e:
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})

    return JSONResponse(content={
        "status": "ok",
        "results": preprocess_results,
        "size": sizes,
        "message": f"Extracted {len(preprocess_results)} frames successfully"
    })

def strip_extension(key: str) -> str:
    return os.path.splitext(key)[0]
