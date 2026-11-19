from .models import QuizAnswers

#translate the answers from the quiz into a format that can be used to query the database for matching cats
AGE_MAP = { 
           "Kitten (Under 1 year)": "kitten",
           "Young adult (2-4 years)": "young_adult",
           "Older adult (5-8 years)": "older_adult",
           "Senior (9+ years)": "senior",
           "Any age is a good age!": None}

STYLE_MAP = {
    "Lap cat": "lap_cat",
    "Likes to be near but not on me": "nearby_companion",
    "Allows pets but is independent": "independent_allows_pets",
    "A little sassy and fesity": "sassy_feisty",
    "Spirit cat": "spirit_cat",
}

def normalize_preferences(answers: QuizAnswers) -> dict:
    """Normalize the quiz answers into a format that can be used to query the database for matching cats."""
    return {
            "preferred_age_group": AGE_MAP.get(answers.age),
            "preferred_companionship_styles": list(dict.fromkeys([STYLE_MAP[label] for label in answers.temperaments])),
            
            "has_dogs": "Dog(s)" in answers.household,
            "has_children": "Children" in answers.household,
            "has_cats": "Cat(s)" in answers.household,
            
            # Preserve these answers without inventing matching rules for them
            "care_willingness": answers.care,
            "desired_cat_count": answers.count,
    }
