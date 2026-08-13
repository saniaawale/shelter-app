import unittest
from dataclasses import replace
from itertools import permutations

from backend.app.matching import CatCandidate, MatchWeights, match_cats
from backend.app.models import QuizAnswers


def make_answers(**changes):
    """Valid synthetic adopter answers; no real account or personal data."""
    values = {
        "readiness": "Within 1 month", "environment": "Quiet",
        "household": [], "experience": "Somewhat experienced",
        "temperaments": ["Lap cat"], "age": "Young adult (2-4 years)",
        "care": "Very open", "count": "1",
    }
    values.update(changes)
    return QuizAnswers(**values)


# Fictional cats live only in these tests; they are never inserted into Supabase.
SYNTHETIC_CATS = [
    CatCandidate(
        source_record_id="synthetic-cat-a", name="Test Cuddle Cat",
        available=True, availability_confirmed=True,
        age_group="young_adult", companionship_style="lap_cat",
        good_with_dogs="yes", good_with_cats="yes",
        good_with_children="yes", care_status="none_documented",
        joint_adoption_required=False,
    ),
    CatCandidate(
        source_record_id="synthetic-cat-b", name="Test Independent Cat",
        available=True, availability_confirmed=True,
        age_group="senior", companionship_style="independent_allows_pets",
        care_status="none_documented",
        joint_adoption_required=False,
    ),
]


class MatchCatsTests(unittest.TestCase):
    # Checks all four preference scores, exact explanations, and ranking across every input order.
    def test_scores_and_ranks_preferences(self):
        # Copy a complete available fixture so only age/style differ between these fictional cats.
        base = SYNTHETIC_CATS[0]
        both = replace(base, source_record_id="synthetic-both", name="Test Both Preferences")
        style_only = replace(base, source_record_id="synthetic-style", name="Test Style Only", age_group="senior")
        age_only = replace(base, source_record_id="synthetic-age", name="Test Age Only",
                           companionship_style="independent_allows_pets")
        neither = replace(base, source_record_id="synthetic-neither", name="Test Neither Preference",
                          age_group="senior", companionship_style="independent_allows_pets")
        cats = [neither, style_only, both, age_only]
        answers = make_answers()

        # Write expected outcomes independently: age earns 2 points and style earns 3.
        # ID alphabetical order differs from score order, catching accidental ID-only sorting.
        expected = [
            ("synthetic-both", 5, [
                "Matches your preferred age group: young_adult.",
                "Matches your preferred companionship style: lap_cat.",
            ]),
            ("synthetic-style", 3, ["Matches your preferred companionship style: lap_cat."]),
            ("synthetic-age", 2, ["Matches your preferred age group: young_adult."]),
            ("synthetic-neither", 0, []),
        ]

        # Try all 24 possible orders, rather than trusting one reversed pair to prove sorting.
        for order in permutations(cats):
            with self.subTest(input_order=[cat.source_record_id for cat in order]):
                # Run actual matching; a different input order must not change the ranking.
                results = match_cats(answers, list(order))

                # Check IDs, scores and explanation text together, retaining even the zero-point cat.
                actual = [(r["source_record_id"], r["score"], r["reasons"]) for r in results["matches"]]
                self.assertEqual(actual, expected)

                # Complete records should have no unresolved flags or misplaced candidates.
                self.assertEqual(results["needs_confirmation"], [])
                self.assertTrue(all(r["considerations"] == [] for r in results["matches"]))

    # Checks archived, unavailable, and unconfirmed-availability cats never enter results.
    def test_filters_unavailable_candidates(self):
        # Create a separate candidate for each reason a record cannot be recommended.
        base = SYNTHETIC_CATS[0]
        for change in [{"archived": True}, {"available": False}, {"availability_confirmed": False}]:
            with self.subTest(change=change):
                # Change one property and run matching without mutating the shared fixture.
                result = match_cats(make_answers(), [replace(base, **change)])
                # Neither confirmed matches nor unresolved candidates should contain the cat.
                self.assertEqual(result, {"matches": [], "needs_confirmation": []})

    # Checks any-age preference accepts all known ages and all supported unknown-age representations equally.
    def test_any_age_matches_known_and_unknown_ages(self):
        # Keep other attributes identical to isolate how each recorded age is handled.
        for age in ["kitten", "young_adult", "older_adult", "senior", None, "", "unknown"]:
            with self.subTest(age=age):
                cat = replace(SYNTHETIC_CATS[0], age_group=age)
                # Submit the explicit any-age choice rather than a specific age group.
                result = match_cats(make_answers(age="Any age is a good age!"), [cat])
                # Only companionship earns points; missing age alone causes no warning.
                self.assertEqual(result["matches"][0]["score"], 3)
                self.assertEqual(result["matches"][0]["considerations"], [])
                self.assertEqual(result["needs_confirmation"], [])
                self.assertIn("No age preference; no age points awarded.", result["matches"][0]["reasons"])

    # Checks a specific age preference still leaves a cat with unknown age unresolved.
    def test_specific_age_keeps_unknown_age_unresolved(self):
        # Remove only age, retaining a known matching companionship style.
        cat = replace(SYNTHETIC_CATS[0], age_group=None)
        # The default quiz answers request young-adult cats specifically.
        result = match_cats(make_answers(), [cat])
        # Unknown age earns no age points when an actual age preference needs checking.
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["needs_confirmation"][0]["score"], 3)
        self.assertIn("Needs confirmation: age group.", result["needs_confirmation"][0]["considerations"])

    # Checks accepting every age does not remove unrelated household compatibility gaps.
    def test_any_age_preserves_other_considerations(self):
        # This available fictional cat has unknown age and unknown dog compatibility.
        cat = replace(SYNTHETIC_CATS[0], age_group=None, good_with_dogs="unknown")
        # Select any age and a household with dogs.
        result = match_cats(make_answers(age="Any age is a good age!", household=["Dog(s)"]), [cat])
        # Only the household question remains unresolved; age is accepted without inventing it.
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["needs_confirmation"][0]["considerations"],
                         ["Needs confirmation: placement in a home with dogs."])

    # Checks unknown profile data earns no points and stays separate from confirmed matches.
    def test_unknown_information_needs_confirmation(self):
        # Remove both scoring attributes from an otherwise available confirmed candidate.
        cat = replace(SYNTHETIC_CATS[0], age_group=None, companionship_style="unknown")
        result = match_cats(make_answers(), [cat])
        # Missing information is explained rather than counted as positive or negative evidence.
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["needs_confirmation"][0]["score"], 0)
        self.assertIn("Needs confirmation: age group.", result["needs_confirmation"][0]["considerations"])

    # Checks recorded profile details can score without any staff-assessment approval flag.
    def test_recorded_details_score_without_staff_approval(self):
        # The fixture contains recorded values and has no assessment-confirmation field.
        cat = SYNTHETIC_CATS[0]
        # Match against all recorded positive household observations as well as age/style.
        result = match_cats(make_answers(household=["Dog(s)", "Cat(s)", "Children"]), [cat])
        # An available complete profile gets full preference points with no approval warning.
        self.assertEqual(result["matches"][0]["score"], 5)
        self.assertEqual(result["matches"][0]["considerations"], [])
        self.assertEqual(result["needs_confirmation"], [])

    # Checks explicit shelter restrictions filter cats before preference scores are awarded.
    def test_applies_confirmed_household_restrictions(self):
        # This fictional staff decision forbids placement in a household with dogs.
        cat = replace(SYNTHETIC_CATS[0], forbidden_households=frozenset({"dogs"}))
        # Supply a household with a dog even though age/style preferences otherwise match.
        result = match_cats(make_answers(household=["Dog(s)"]), [cat])
        # A high preference score must never override the explicit restriction.
        self.assertEqual(result, {"matches": [], "needs_confirmation": []})

    # Checks all household categories and both unknown/negative observations require review, not automatic rejection.
    def test_unresolved_household_compatibility_is_flagged(self):
        # Cover dogs, cats, and children independently using their on-screen quiz labels.
        for label, field in [("Dog(s)", "good_with_dogs"), ("Cat(s)", "good_with_cats"), ("Children", "good_with_children")]:
            for value in ["unknown", "no"]:
                with self.subTest(household=label, observation=value):
                    cat = replace(SYNTHETIC_CATS[0], **{field: value})
                    # No explicit shelter restriction is supplied in this test.
                    result = match_cats(make_answers(household=[label]), [cat])
                    # Compatibility adds no score penalty; uncertainty stays visible in its own bucket.
                    self.assertEqual(result["matches"], [])
                    self.assertEqual(result["needs_confirmation"][0]["score"], 5)

    # Checks compatibility is considered only for the household actually selected by the adopter.
    def test_known_compatible_household_can_match(self):
        # The first fixture has confirmed positive observations for all three household categories.
        answers = make_answers(household=["Dog(s)", "Cat(s)", "Children"])
        result = match_cats(answers, [SYNTHETIC_CATS[0]])
        # Household compatibility permits consideration without adding preference points.
        self.assertEqual(len(result["matches"]), 1)
        self.assertEqual(result["matches"][0]["score"], 5)

    # Checks care and joint-adoption gaps remain unresolved even when preferences score highly.
    def test_care_and_joint_adoption_need_specific_review(self):
        # General care willingness and cat count cannot settle these cat-specific questions.
        for change in [{"care_status": "unknown"}, {"care_status": "documented"},
                       {"joint_adoption_required": None}, {"joint_adoption_required": True}]:
            with self.subTest(change=change):
                cat = replace(SYNTHETIC_CATS[0], **change)
                result = match_cats(make_answers(care="Very open", count="2+"), [cat])
                # The candidate remains visible for review rather than being falsely confirmed.
                self.assertEqual(result["matches"], [])
                self.assertTrue(result["needs_confirmation"][0]["considerations"])

    # Checks weights can be configured independently of the scoring function.
    def test_custom_weights(self):
        # Use different nonnegative weights to prove the defaults are not hardcoded in scoring.
        weights = MatchWeights(companionship=4, age=1)
        result = match_cats(make_answers(), [SYNTHETIC_CATS[0]], weights)
        # This candidate matches both preferences, so the total is four plus one.
        self.assertEqual(result["matches"][0]["score"], 5)
        # A specific nonmatching age isolates the configurable companionship weight.
        result = match_cats(make_answers(age="Senior (9+ years)"), [SYNTHETIC_CATS[0]], weights)
        self.assertEqual(result["matches"][0]["score"], 4)

    # Checks invalid negative weights are rejected instead of turning preferences into penalties.
    def test_rejects_negative_weights(self):
        # Exercise both configurable weights independently.
        for changes in [{"age": -1}, {"companionship": -1}]:
            with self.subTest(changes=changes):
                # Creating this configuration must fail immediately with a clear error.
                with self.assertRaises(ValueError):
                    MatchWeights(**changes)

    # Checks cats with duplicate names remain distinct and ties are resolved consistently by ID.
    def test_duplicate_names_and_score_ties(self):
        # Give two distinct fictional IDs identical names and matching attributes.
        first = replace(SYNTHETIC_CATS[0], source_record_id="synthetic-a", name="Same Test Name")
        second = replace(first, source_record_id="synthetic-b")
        result = match_cats(make_answers(), [second, first])
        # Neither cat is merged; input order does not change the tied ranking.
        self.assertEqual([r["source_record_id"] for r in result["matches"]], ["synthetic-a", "synthetic-b"])

    # Checks no candidates produces honest empty lists rather than a forced recommendation.
    def test_empty_candidates(self):
        # Run the normal matching path with no cat records.
        result = match_cats(make_answers(), [])
        # Neither result category should contain invented data.
        self.assertEqual(result, {"matches": [], "needs_confirmation": []})


if __name__ == "__main__":
    unittest.main()
