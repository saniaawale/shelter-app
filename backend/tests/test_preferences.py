import unittest
from itertools import product

from backend.app.models import QuizAnswers
from backend.app.preferences import normalize_preferences


def make_answers(**changes):
    """Build valid synthetic quiz answers, replacing only what a test needs."""
    values = {
        "readiness": "Next month",
        "environment": "Quiet household",
        "household": [],
        "experience": "Somewhat experienced",
        "temperaments": ["Lap cat"],
        "age": "Any age is a good age!",
        "care": "Very open",
        "count": "1",
    }
    values.update(changes)
    return QuizAnswers(**values)


class NormalizePreferencesTests(unittest.TestCase):
    # Checks every specific age choice translates to the category stored for cats.
    def test_maps_each_age_group(self):
        # These expected values are independent of AGE_MAP, so a wrong mapping is detected.
        cases = [
            ("Kitten (Under 1 year)", "kitten"),
            ("Young adult (2-4 years)", "young_adult"),
            ("Older adult (5-8 years)", "older_adult"),
            ("Senior (9+ years)", "senior"),
        ]
        for label, expected in cases:
            with self.subTest(age=label):
                # Give the normalizer one validated age selection at a time.
                answers = make_answers(age=label)
                preferences = normalize_preferences(answers)

                # Check the result matches the database category, not the screen label.
                self.assertEqual(preferences["preferred_age_group"], expected)

    # Checks that choosing any age expresses no preference rather than a specific category.
    def test_any_age_becomes_no_preference(self):
        # Construct the explicit no-preference answer and normalize it.
        answers = make_answers(age="Any age is a good age!")
        preferences = normalize_preferences(answers)

        # None represents the any-age choice; matching accepts both known and unknown ages for it.
        self.assertIsNone(preferences["preferred_age_group"])

    # Checks all five temperament labels translate to the expected companionship categories.
    def test_maps_each_temperament(self):
        # Keep expected categories here rather than importing STYLE_MAP into the test.
        cases = [
            ("Lap cat", "lap_cat"),
            ("Likes to be near but not on me", "nearby_companion"),
            ("Allows pets but is independent", "independent_allows_pets"),
            ("A little sassy and fesity", "sassy_feisty"),
            ("Spirit cat", "spirit_cat"),
        ]
        for label, expected in cases:
            with self.subTest(temperament=label):
                # Submit a single temperament so each translation is checked independently.
                answers = make_answers(temperaments=[label])
                preferences = normalize_preferences(answers)

                # The output remains a list even when only one style is selected.
                self.assertEqual(preferences["preferred_companionship_styles"], [expected])

    # Checks multiple selected temperaments are retained in their original order.
    def test_preserves_multiple_temperaments(self):
        # Use a deliberate order to catch dropped or reordered preferences.
        answers = make_answers(temperaments=["Spirit cat", "Lap cat"])
        preferences = normalize_preferences(answers)

        # Both translated styles must remain, in the order selected.
        self.assertEqual(
            preferences["preferred_companionship_styles"],
            ["spirit_cat", "lap_cat"],
        )

    # Checks repeated selections do not create duplicate styles or reorder unique choices.
    def test_removes_duplicate_temperaments(self):
        # Repeat both styles to exercise the normalizer's deduplication.
        answers = make_answers(temperaments=["Spirit cat", "Lap cat", "Spirit cat", "Lap cat"])
        preferences = normalize_preferences(answers)

        # Each category should appear exactly once, in first-occurrence order.
        self.assertEqual(
            preferences["preferred_companionship_styles"],
            ["spirit_cat", "lap_cat"],
        )

    # Checks all eight combinations of dogs, cats and children produce independent boolean flags.
    def test_household_flags_for_every_combination(self):
        # product generates every possible combination of three yes/no selections.
        for dogs, cats, children in product([False, True], repeat=3):
            with self.subTest(dogs=dogs, cats=cats, children=children):
                household = [
                    label for label, selected in [
                        ("Dog(s)", dogs), ("Cat(s)", cats), ("Children", children),
                    ] if selected
                ]

                # Normalize the household containing only the selected screen labels.
                preferences = normalize_preferences(make_answers(household=household))

                # Each flag must be the actual boolean for its corresponding selection.
                self.assertIs(preferences["has_dogs"], dogs)
                self.assertIs(preferences["has_cats"], cats)
                self.assertIs(preferences["has_children"], children)

    # Checks care willingness and cat-count choices are preserved without adding eligibility rules.
    def test_preserves_care_and_count_choices(self):
        # Exercise every supported care choice with both supported cat-count choices.
        care_choices = [
            "Very open",
            "Somewhat open - it depends on the needs",
            "Not open at all",
        ]
        for care, count in product(care_choices, ["1", "2+"]):
            with self.subTest(care=care, count=count):
                # Normalize valid answers containing this pair of choices.
                preferences = normalize_preferences(make_answers(care=care, count=count))

                # Keep the original answers; do not reinterpret them as clinical or placement decisions.
                self.assertEqual(preferences["care_willingness"], care)
                self.assertEqual(preferences["desired_cat_count"], count)

    # Checks normalization creates a translated result without altering the original quiz answers.
    def test_does_not_change_original_answers(self):
        # Save an independent snapshot containing duplicate styles and a household selection.
        answers = make_answers(temperaments=["Lap cat", "Lap cat"], household=["Cat(s)"])
        before = answers.model_dump()

        # Run normalization, including the operation that removes duplicate output styles.
        normalize_preferences(answers)

        # The caller's original answers must remain exactly as submitted.
        self.assertEqual(answers.model_dump(), before)


if __name__ == "__main__":
    unittest.main()
