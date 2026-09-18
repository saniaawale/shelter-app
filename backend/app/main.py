import os


from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import QuizAnswers
from .preferences import normalize_preferences
from .cat_repository import CatDataUnavailable, load_cat_candidates
from .matching import match_cats

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

@app.get("/")
def home():
    return {"message": "Shelter API is running"}


@app.post("/quiz/preview")
def preview_quiz(answers: QuizAnswers):
    normalized = normalize_preferences(answers)
    return {
        "message": "Quiz answers received",
        "answers": answers.model_dump(),
        "preferences" : normalized,
    }

@app.post("/matches")
def find_matches(answers: QuizAnswers):
    try:
        candidates = load_cat_candidates()  # from cat_repo.py
    except CatDataUnavailable:
        raise HTTPException(
            status_code=503,
            detail="Cat matching is temporarily unavailable. Please try again later",
        ) from None

    return match_cats(answers, candidates)