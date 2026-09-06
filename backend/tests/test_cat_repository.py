import os
import unittest
from unittest.mock import patch

import psycopg
from fastapi import HTTPException

from backend.app.cat_repository import CatDataUnavailable, load_cat_candidates, row_to_candidate
from backend.app.main import find_matches
from backend.app.matching import match_cats
from backend.tests.test_matching import make_answers


def make_row(**changes):
    row = {
        "source_record_id": "synthetic-cat-id", "Name": "Test Cat",
        "availability_status": "confirmed_available", "archived_at": None,
        "age_group": "young_adult", "companionship_style": "lap_cat",
        "good_with_dogs": "yes", "good_with_cats": "no", "good_with_kids": None,
        "special_needs": None,
    }
    row.update(changes)
    return row


class CatRepositoryTests(unittest.TestCase):
    # Checks real column names map correctly while absent policy/care information stays unresolved.
    def test_maps_database_fields_without_inventing_assessments(self):
        # Use a fictional row with known age/style and incomplete other information.
        cat = row_to_candidate(make_row(), "confirmed_available")
        result = match_cats(make_answers(), [cat])
        # Recorded preferences score, but the profile cannot be called a confirmed placement match.
        self.assertEqual(cat.good_with_dogs, "yes")
        self.assertEqual(cat.good_with_cats, "no")
        self.assertEqual(cat.good_with_children, "unknown")
        self.assertEqual(cat.care_status, "unknown")
        self.assertIsNone(cat.joint_adoption_required)
        self.assertEqual(result["matches"], [])
        self.assertEqual(result["needs_confirmation"][0]["score"], 5)
        self.assertIn("Needs confirmation: shelter placement requirements.",
                      result["needs_confirmation"][0]["considerations"])

    # Checks missing availability and archived records cannot leak into recommendations.
    def test_excludes_unavailable_and_archived_records(self):
        # Change one availability-related field at a time on a fictional record.
        for changes in [{"availability_status": None}, {"availability_status": "adopted"},
                        {"archived_at": "2026-01-01"}]:
            with self.subTest(changes=changes):
                cat = row_to_candidate(make_row(**changes), "confirmed_available")
                # Neither result bucket may contain these records.
                self.assertEqual(match_cats(make_answers(), [cat]),
                                 {"matches": [], "needs_confirmation": []})

    # Checks unrecognized free-text values never receive preference points or invented compatibility.
    def test_unrecognized_values_remain_unknown(self):
        # Supply descriptions instead of the supported structured categories.
        cat = row_to_candidate(make_row(age_group="probably young", companionship_style="friendly",
                                       good_with_dogs="probably", bonded_group_ID=False),
                               "confirmed_available")
        # The adapter must not turn those observations or the paired boolean into confirmed facts.
        self.assertIsNone(cat.age_group)
        self.assertIsNone(cat.companionship_style)
        self.assertEqual(cat.good_with_dogs, "unknown")
        self.assertIsNone(cat.joint_adoption_required)

    # Checks missing credentials or the status definition produces an explicit configuration failure.
    def test_requires_database_and_status_configuration(self):
        # Remove settings without reading or changing the project's actual environment file.
        for settings in [{}, {"DATABASE_URL": "postgresql://example.invalid/postgres"}]:
            with self.subTest(settings=settings), patch.dict(os.environ, settings, clear=True):
                # No database connection should be attempted with incomplete configuration.
                with self.assertRaises(CatDataUnavailable):
                    load_cat_candidates()

    # Checks the repository selects only matching fields and filters with a bound status parameter.
    def test_queries_records_read_only(self):
        # Replace the database transport with a mock; no live records are used as fixtures.
        settings = {"DATABASE_URL": "postgresql://example.invalid/postgres",
                    "MATCHING_AVAILABLE_STATUS": "confirmed_available"}
        with patch.dict(os.environ, settings), patch("backend.app.cat_repository.psycopg.connect") as connect:
            connection = connect.return_value.__enter__.return_value
            cursor = connection.cursor.return_value.__enter__.return_value
            cursor.fetchall.return_value = [make_row()]
            # Load through the actual repository and i nspect the SQL sent to the mocked transport.
            cats = load_cat_candidates()
            query, parameters = cursor.execute.call_args.args
            # Verify privacy boundaries, read-only mode and parameter binding, not live database permissions.
            self.assertTrue(connection.read_only)
            self.assertIn('FROM public."Cat Profiles"', query)
            self.assertIn('archived_at IS NULL', query)
            self.assertNotIn("foster_id", query)
            self.assertNotIn("original_foster_description", query)
            self.assertEqual(parameters, ("confirmed_available",))
            self.assertEqual(cats[0].source_record_id, "synthetic-cat-id")

    # Checks database failures are converted into a safe application error without credentials.