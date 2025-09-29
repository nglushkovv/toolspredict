from fastapi import FastAPI
from fastapi.responses import JSONResponse
from minio import Minio
from pydantic import BaseModel
from typing import Optional, Tuple, Any, Dict
from io import BytesIO
import json
import os
import re

from PIL import Image
import torch
from transformers import AutoProcessor, AutoModelForCausalLM

from app.config import settings

app = FastAPI()

# MinIO client
minio_client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False
)

# DTO
class EnrichmentRequest(BaseModel):
    raw_file_key: str
    processed_file_key: str

# Патч для отключения flash_attn в динамических импортерах HF (Florence-2)
def _patch_hf_dynamic_imports():
    try:
        import transformers.dynamic_module_utils as dmu
        _orig_get_imports = dmu.get_imports

        def patched_get_imports(filename):
            imports = _orig_get_imports(filename)
            try:
                fn = str(filename)
            except Exception:
                fn = ""
            if fn.endswith("modeling_florence2.py") and "flash_attn" in imports:
                imports = [imp for imp in imports if imp != "flash_attn"]
            return imports

        dmu.get_imports = patched_get_imports
    except Exception:
        # Если что-то пошло не так — просто продолжаем без патча (на CPU обычно ок)
        pass

# OCR сервис-обертка
class OCRService:
    def __init__(self, model_id: str = "microsoft/Florence-2-large"):
        _patch_hf_dynamic_imports()

        self.model = AutoModelForCausalLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch.float32  # CPU
        ).eval()

        self.processor = AutoProcessor.from_pretrained(
            model_id,
            trust_remote_code=True
        )

    def _process_model_output(self, text: str) -> Optional[str]:
        """
        Извлекает и форматирует код вида AT-XXXXXXX.
        Если дефис перед последней цифрой отсутствует — добавляет.
        """
        match = re.search(r"AT-\d{7}", text)
        if not match:
            return None
        code = match.group()  # например, 'AT-2882935'
        # Превратить в 'AT-XXXXXX-X', если нет дефиса перед последней цифрой
        if not re.match(r"AT-\d{6}-\d", code):
            code = code[:-1] + "-" + code[-1]
        return code

    def run_ocr(self, image: Image.Image) -> Tuple[Optional[str], str]:
        """
        Возвращает (processed_marking, raw_output)
        processed_marking может быть None, если ничего не найдено.
        """
        prompt = "<OCR>"
        inputs = self.processor(text=prompt, images=image.convert("RGB"), return_tensors="pt")

        with torch.no_grad():
            generated_ids = self.model.generate(
                input_ids=inputs["input_ids"],
                pixel_values=inputs["pixel_values"],
                max_new_tokens=1024,
                early_stopping=False,
                do_sample=False,
                num_beams=3,
            )

        raw_output = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        processed = self._process_model_output(raw_output)
        return processed, raw_output


def get_image_from_minio(bucket: str, object_name: str) -> Image.Image:
    resp = None
    try:
        resp = minio_client.get_object(bucket, object_name)
        data = resp.read()
        img = Image.open(BytesIO(data)).convert("RGB")
        return img
    finally:
        if resp is not None:
            resp.close()
            resp.release_conn()

def get_json_from_minio(bucket: str, object_name: str) -> Dict[str, Any]:
    resp = None
    try:
        resp = minio_client.get_object(bucket, object_name)
        data = resp.read()
        meta = json.loads(data.decode("utf-8"))
        return meta
    finally:
        if resp is not None:
            resp.close()
            resp.release_conn()

def extract_bbox(meta: Dict[str, Any]) -> Optional[Tuple[int, int, int, int]]:
    """
    Пытается извлечь bbox из meta.
    Поддерживает форматы:
    - {"bbox": [x1, y1, x2, y2]}
    - {"bbox": {"x1":..., "y1":..., "x2":..., "y2":...}}
    - {"bboxes": [[x1, y1, x2, y2], ...]} — берём первый
    """
    if "bbox" in meta:
        bbox = meta["bbox"]
        if isinstance(bbox, list) and len(bbox) == 4:
            return tuple(int(v) for v in bbox)
        if isinstance(bbox, dict):
            keys = ["x1", "y1", "x2", "y2"]
            if all(k in bbox for k in keys):
                return tuple(int(bbox[k]) for k in keys)
    if "bboxes" in meta and isinstance(meta["bboxes"], list) and meta["bboxes"]:
        first = meta["bboxes"][0]
        if isinstance(first, list) and len(first) == 4:
            return tuple(int(v) for v in first)
    return None

@app.on_event("startup")
def load_model_on_startup():
    app.state.ocr_service = OCRService()
    print("OCR модель успешно загружена и готова к работе")

@app.post("/enrich")
async def enrich(request: EnrichmentRequest):
    raw_bucket = getattr(settings, "minio_bucket_raw")
    processed_bucket = getattr(settings, "minio_bucket_processed")

    try:
        # 1) Читаем картинку
        img = get_image_from_minio(raw_bucket, request.raw_file_key)

        # 2) Читаем метаданные (processed JSON) и пытаемся взять bbox
        meta = get_json_from_minio(processed_bucket, request.processed_file_key)
        bbox = extract_bbox(meta)

        # 3) Кроп, если есть bbox
        if bbox is not None:
            x1, y1, x2, y2 = bbox
            # Защита от невалидных значений
            w, h = img.size
            x1 = max(0, min(x1, w))
            x2 = max(0, min(x2, w))
            y1 = max(0, min(y1, h))
            y2 = max(0, min(y2, h))
            if x2 > x1 and y2 > y1:
                img = img.crop((x1, y1, x2, y2))

        # 4) OCR
        ocr_service: OCRService = app.state.ocr_service
        marking, _raw = ocr_service.run_ocr(img)

        return JSONResponse(content={"marking": marking})
    except Exception as e:
        # В случае любой ошибки — возвращаем marking: null
        return JSONResponse(content={"marking": None})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)