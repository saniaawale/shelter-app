import unittest

from pydantic import ValidationError

from backend.tests.test_matching import make_answers


class QuizChoiceTests(unittest.TestCase):
    # Every approved readiness/environment combination must pass backend validation.
    def test_accepts_approved_choices(self):
        # Exercise all choices without connecting to a database or using personal records.
        for readiness in ["Ready now", "Within 1 month", "Within 3 months", "Just exploring"]:
            for environment in ["Quiet", "Moderately active", "Very active"]:
                with self.subTest(readiness=readiness, environment=environment):
                    answers = make_answers(readiness=readiness, environment=environment)
                    # The API model must preserve exactly what the adopter selected.
                    self.assertEqual(answers.readiness, readiness)
                    self.assertEqual(answers.environment, environment)

    # Arbitrary typed or blank answers must not bypass the new multiple-choice rules.
    def test_rejects_unapproved_choices(self):
        # Include legacy free-text answers and empty values for each changed field.
        for field, value in [("readiness", "Next month"), ("readiness", ""),
                             ("environment", "Quiet household"), ("environment", "")]:
            with self.subTest(field=field, value=value):
                # Constructing the same model FastAPI uses must reject these inputs.
                with self.assertRaises(ValidationError):
                    make_answers(**{field: value})
