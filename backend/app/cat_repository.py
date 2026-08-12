""" read postgres records and traslate them for the matching engine"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

from .matching import CatCandidate
from .preferences import AGE_MAP, STYLE_MAP

load_dotenv(Path(__file__).resolve().parents[1] / ".env")  # load settings from .env file

class CatDataUnavailable(Exception):
    """Raised when the cat data is unavailable from the database"""
    pass

def compatibility(value):
    return value if value in ("yes", "no") else "unknown"

def row_to_candidate(row: dict,available_status: str) -> CatCandidate:
    """Use recorded structured values"""
    age = row.get("age_group")
    style = row.get("companionship_style")
    care = row.get("special_needs")
    status_confirmed = row.get("availability_status") == available_status
    
    
    return CatCandidate(
        source_record_id = str(row["source_record_id"]),
        name=row.get("Name") or "Unnamed Cat",
        available= status_confirmed,
        availability_confirmed=status_confirmed,
        archived=row.get("archived_at") is not None,
        age_group=age if age in AGE_MAP.values() else None,
        companionship_style=style if style in STYLE_MAP.values() else None,
        good_with_dogs=compatibility(row["good_with_dogs"]),
        good_with_cats=compatibility(row["good_with_cats"]),
        good_with_children=compatibility(row["good_with_kids"]),
        # blank notes cant confirm that the cat has no care needs
        care_status="documented" if care and care.lower() != "unknown" else "unknown",
        joint_adoption_required=None,
        placement_requirements_known = False,
    )
    
def load_cat_candidates() -> list[CatCandidate]:
    database_url = os.getenv("DATABASE_URL","").strip()
    available_status = os.getenv("MATCHING_AVAILABLE_STATUS", "").strip()
    if not database_url or not available_status:
        raise CatDataUnavailable("Matching database configuration is incomplete")
    
    try:
        with psycopg.connect(database_url, connect_timeout = 5, sslmode = "require", row_factory=dict_row) as connection:
            connection.read_only = True
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '5s'")
                cursor.execute(
                    '''SELECT source_record_id, "Name", age_group, companionship_style,
                              special_needs, availability_status, archived_at,
                              good_with_dogs, good_with_cats, good_with_kids
                       FROM public."Cat Profiles"
                       WHERE availability_status = %s AND archived_at IS NULL
                       ORDER BY source_record_id''',
                    (available_status,),
                )
                rows = cursor.fetchall()
    except (psycopg.Error, ValueError):
        # Do not expose credentials, database errors, or private records to guests.
        raise CatDataUnavailable("Cat records could not be loaded.") from None

    return [row_to_candidate(row, available_status) for row in rows]


