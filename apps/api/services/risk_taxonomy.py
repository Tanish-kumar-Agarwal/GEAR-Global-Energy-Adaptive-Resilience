"""
Deterministic mapping from raw event vocabulary to the four risk categories the War Room
reports on. Keyword driven rather than model driven so a category assignment can always be
explained by the token that produced it.
"""

import re
from typing import Dict, List, Optional, Tuple

CATEGORIES = ["GEOPOLITICAL", "LOGISTICS", "SUPPLY", "MARKET"]

CATEGORY_LABELS = {
    "GEOPOLITICAL": "Geopolitical Risk",
    "LOGISTICS": "Logistics Risk",
    "SUPPLY": "Supply Risk",
    "MARKET": "Market Risk",
}

# Order matters: the first category with a keyword hit wins, so the more specific
# vocabularies are checked before the broader ones.
CATEGORY_KEYWORDS: List[Tuple[str, Tuple[str, ...]]] = [
    (
        "LOGISTICS",
        (
            "maritime", "naval", "shipping", "vessel", "tanker", "port", "transit",
            "route", "blockade", "canal", "strait", "chokepoint", "congestion",
            "ais", "convoy", "freight", "berth",
        ),
    ),
    (
        "GEOPOLITICAL",
        (
            "conflict", "war", "military", "strike", "attack", "sanction", "policy",
            "tariff", "export control", "embargo", "protest", "unrest", "coup",
            "election", "diplomat", "harassment", "seizure",
        ),
    ),
    (
        "SUPPLY",
        (
            "outage", "production", "refinery", "field", "maintenance", "pipeline",
            "shutdown", "supply", "wellhead", "capacity", "curtail",
        ),
    ),
    (
        "MARKET",
        ("price", "demand", "inventory", "market", "trade balance", "spread", "contango"),
    ),
]


def _hit(keyword: str, haystack: str) -> bool:
    """
    Whole-word match with an optional plural or participle suffix. Substring matching
    would classify "exports" as a port event, which is how a policy story ends up in the
    logistics bucket.
    """
    return re.search(rf"\b{re.escape(keyword)}(s|es|ed|ing)?\b", haystack) is not None


def classify(*texts: Optional[str]) -> Optional[str]:
    """
    Return the risk category implied by the given free-text fields, or None when no
    keyword matches. Callers surface unclassified events rather than forcing a bucket.
    """
    haystack = " ".join(t.lower() for t in texts if t)
    if not haystack.strip():
        return None
    for category, keywords in CATEGORY_KEYWORDS:
        if any(_hit(keyword, haystack) for keyword in keywords):
            return category
    return None


def matched_keywords(category: str, *texts: Optional[str]) -> List[str]:
    """The keywords that caused a classification, used for explainability."""
    haystack = " ".join(t.lower() for t in texts if t)
    for name, keywords in CATEGORY_KEYWORDS:
        if name == category:
            return [k for k in keywords if _hit(k, haystack)]
    return []


def empty_category_map() -> Dict[str, list]:
    return {category: [] for category in CATEGORIES}
