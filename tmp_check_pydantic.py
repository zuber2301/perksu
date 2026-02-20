import json
from decimal import Decimal
from uuid import UUID

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

# Mocking wait for it
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

class RecognitionCreate(BaseModel):
    to_user_id: Optional[UUID] = None
    to_user_ids: Optional[List[UUID]] = None
    badge_id: Optional[UUID] = None
    points: Decimal
    message: str
    recognition_type: str = "standard"
    ecard_template: Optional[str] = None
    visibility: str = "public"
    is_equal_split: bool = False

payload = {
    "to_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "points": 200.0,
    "message": "Excellent work on the project! This is a high impact contribution.",
    "recognition_type": "individual_award",
    "visibility": "public"
}

try:
    RecognitionCreate(**payload)
    print("Payload is valid for RecognitionCreate")
except Exception as e:
    print(f"Payload INVALID: {e}")
