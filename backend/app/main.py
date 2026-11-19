from fastapi import FastAPI

from .models import QuizAnswers
from .preferences import normalize_preferences


app = FastAPI()


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
