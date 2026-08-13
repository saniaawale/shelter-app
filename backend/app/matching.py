"""Deterministic matching using normalized, recorded cat information.

This internal model is not a Supabase schema. A database adapter will need
to supply current availability and recorded cat details before using real records.
"""

from dataclasses import dataclass, field
from typing import Literal

from .models import QuizAnswers
from .preferences import normalize_preferences


Compatibility = Literal["yes", "no", "unknown"]
Household = Literal["dogs", "cats", "children"]


@dataclass(frozen=True)
class CatCandidate:
    source_record_id: str
    name: str
    available: bool = False
    availability_confirmed: bool = False
    archived: bool = False
    age_group: str | None = None
    companionship_style: str | None = None
    good_with_dogs: Compatibility = "unknown"
    good_with_cats: Compatibility = "unknown"
    good_with_children: Compatibility = "unknown"
    care_status: Literal["none_documented", "documented", "unknown"] = "unknown"
    joint_adoption_required: bool | None = None
    # Only explicit shelter-confirmed restrictions belong here, not foster guesses.
    forbidden_households: frozenset[Household] = field(default_factory=frozenset)
    placement_requirements_known:bool = True
    
    
    


@dataclass(frozen=True)
class MatchWeights:
    companionship: int = 3
    age: int = 2

    def __post_init__(self):
        if self.companionship < 0 or self.age < 0:
            raise ValueError("Matching weights cannot be negative")

# MOST IMPORTANT FUNCTION
def match_cats(
    answers: QuizAnswers,
    cats: list[CatCandidate],
    weights: MatchWeights | None = None,
) -> dict:
    """Filter candidates, score preferences, and separate unresolved information."""
    preferences = normalize_preferences(answers)
    weights = weights if weights is not None else MatchWeights()
    results = {"matches": [], "needs_confirmation": []}
    household = {
        kind for kind in ("dogs", "cats", "children")
        if preferences[f"has_{kind}"]
    }

    for cat in cats:
        # Availability must be  confirmed before a cat is considered.
        if cat.archived or not cat.available or not cat.availability_confirmed:
            continue

        # Restrictions are supplied explicitly by staff; preferences never create them.
        if household.intersection(cat.forbidden_households):
            continue

        score = 0
        reasons = []
        considerations = []
        if not cat.placement_requirements_known:
            considerations.append("Needs confirmation: shelter placement requirements.")

        if preferences["preferred_age_group"] is None:
            # Any age accepts known and unknown ages equally; it does not assert a known age.
            reasons.append("No age preference; no age points awarded.")
        elif cat.age_group in (None, "", "unknown"):
            considerations.append("Needs confirmation: age group.")
        elif preferences["preferred_age_group"] == cat.age_group:
            score += weights.age
            reasons.append(f"Matches your preferred age group: {cat.age_group}.")

        if cat.companionship_style in (None, "", "unknown"):
            considerations.append("Needs confirmation: companionship style.")
        elif cat.companionship_style in preferences["preferred_companionship_styles"]:
            score += weights.companionship
            reasons.append(f"Matches your preferred companionship style: {cat.companionship_style}.")

        compatibility = {
            "dogs": cat.good_with_dogs,
            "cats": cat.good_with_cats,
            "children": cat.good_with_children,
        }
        for kind in sorted(household):
            if compatibility[kind] != "yes":
                # A negative observation is not automatically a confirmed placement rule.
                considerations.append(f"Needs confirmation: placement in a home with {kind}.")

        if cat.care_status == "unknown":
            considerations.append("Needs confirmation: documented care needs.")
        elif cat.care_status == "documented":
            # General willingness is not approval for a specific treatment or care routine.
            considerations.append("Needs confirmation: ability to support this cat's specific care needs.")

        if cat.joint_adoption_required is not False:
            # Group membership and partner availability must be resolved before joint recommendations.
            considerations.append("Needs confirmation: joint-adoption arrangement.")

        result = {
            "source_record_id": cat.source_record_id,
            "name": cat.name,
            "score": score,
            "reasons": reasons,
            "considerations": considerations,
        }
        bucket = "needs_confirmation" if considerations else "matches"
        results[bucket].append(result)

    # Sorting by ID breaks score ties consistently without scoring names or profile wording.
    for bucket in results.values():
        bucket.sort(key=lambda result: (-result["score"], result["source_record_id"]))

    return results
