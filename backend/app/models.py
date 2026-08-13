from typing import Literal

from pydantic import BaseModel, Field


class QuizAnswers(BaseModel):
    readiness: Literal["Ready now", "Within 1 month", "Within 3 months", "Just exploring"]
    environment: Literal["Quiet", "Moderately active", "Very active"]

    household: list[Literal[
        "Dog(s)",
        "Cat(s)",
        "Children",
    ]] = Field(default_factory=list)

    experience: Literal[
        "Very experienced",
        "Somewhat experienced",
        "No experience",
    ]

    temperaments: list[Literal[
        "Lap cat",
        "Likes to be near but not on me",
        "Allows pets but is independent",
        "A little sassy and fesity",
        "Spirit cat",
    ]] = Field(min_length=1)

    age: Literal[
        "Kitten (Under 1 year)",
        "Young adult (2-4 years)",
        "Older adult (5-8 years)",
        "Senior (9+ years)",
        "Any age is a good age!",
    ]

    care: Literal[
        "Very open",
        "Somewhat open - it depends on the needs",
        "Not open at all",
    ]

    count: Literal["1", "2+"]
