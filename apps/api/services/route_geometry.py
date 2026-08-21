"""Derives drawable route geometry from entities that already carry coordinates.

A route path is built from data the platform already owns (energy_assets,
chokepoints, trade_flows, suppliers), never from a separate geo dataset:

  origin asset -> chokepoints the route passes through -> destination asset

Origin is a PORT (falling back to any asset) in the country of the supplier
that ships the largest volume over the route. Destination is a PORT (falling
back to any asset) in the destination country with the largest volume that has
at least one asset. A chokepoint is attributed to a route when either:
  1. a significant token of its name appears in the route name
     (e.g. "Strait of Hormuz" -> HORMUZ in "Middle East to Asia via Hormuz"), or
  2. it lies within CORRIDOR_WIDTH_DEG degrees of the straight origin ->
     destination segment (a coarse equirectangular shipping-corridor test).
Chokepoints are ordered along the path by distance from the origin.
"""

import math
from typing import Dict, List, Optional

from models.domain import Chokepoint, EnergyAsset, Route, Supplier, TradeFlow

CORRIDOR_WIDTH_DEG = 3.0

# Generic words that carry no identity ("Strait of Hormuz" -> {"HORMUZ"}).
# Connectives (AND, TO, VIA) must be here too: "via Hormuz and Malacca" would
# otherwise token-match "Suez Canal and SUMED" on the shared "AND".
_GENERIC_NAME_TOKENS = {"STRAIT", "OF", "THE", "CANAL", "CAPE", "GULF", "SEA", "CHANNEL", "AND", "TO", "VIA"}


def _significant_tokens(name: str) -> set:
    return {t for t in (name or "").upper().replace("-", " ").split() if t not in _GENERIC_NAME_TOKENS}


def _pick_asset(assets: List[EnergyAsset], country_id: str) -> Optional[EnergyAsset]:
    candidates = [a for a in assets if a.country_id == country_id and a.latitude is not None and a.longitude is not None]
    ports = [a for a in candidates if a.type == "PORT"]
    pool = ports or candidates
    # Deterministic: largest capacity wins, id breaks ties
    return max(pool, key=lambda a: (a.capacity or 0.0, a.id), default=None) if pool else None


def _in_corridor(cp: Chokepoint, origin: EnergyAsset, dest: EnergyAsset) -> bool:
    """Distance (in degrees, equirectangular with lng scaled by cos of the mean
    latitude) from the chokepoint to the origin->dest segment, against
    CORRIDOR_WIDTH_DEG. Coarse on purpose: it only has to separate 'on the way'
    from 'a different sea'."""
    if cp.latitude is None or cp.longitude is None:
        return False
    scale = math.cos(math.radians((origin.latitude + dest.latitude) / 2.0))
    ox, oy = origin.longitude * scale, origin.latitude
    dx, dy = dest.longitude * scale, dest.latitude
    px, py = cp.longitude * scale, cp.latitude
    seg_x, seg_y = dx - ox, dy - oy
    seg_len_sq = seg_x ** 2 + seg_y ** 2
    if seg_len_sq == 0:
        return False
    t = max(0.0, min(1.0, ((px - ox) * seg_x + (py - oy) * seg_y) / seg_len_sq))
    nearest_x, nearest_y = ox + t * seg_x, oy + t * seg_y
    return math.hypot(px - nearest_x, py - nearest_y) <= CORRIDOR_WIDTH_DEG


def derive_route_geometries(db) -> Dict[str, dict]:
    """Returns {route_id: {"path": [[lng, lat], ...], "chokepoint_ids": [...]}}.

    Routes for which no origin/destination pair can be resolved are omitted so
    callers never store a degenerate one-point path.
    """
    routes = db.query(Route).all()
    chokepoints = db.query(Chokepoint).all()
    assets = db.query(EnergyAsset).all()
    flows = db.query(TradeFlow).all()
    supplier_country = {s.id: s.country_id for s in db.query(Supplier).all()}

    result: Dict[str, dict] = {}
    for route in routes:
        route_flows = [f for f in flows if f.route_id == route.id]
        if not route_flows:
            continue

        origin_volumes: Dict[str, float] = {}
        dest_volumes: Dict[str, float] = {}
        for f in route_flows:
            o_country = supplier_country.get(f.supplier_id)
            if o_country:
                origin_volumes[o_country] = origin_volumes.get(o_country, 0.0) + (f.volume or 0.0)
            if f.destination_country_id:
                dest_volumes[f.destination_country_id] = dest_volumes.get(f.destination_country_id, 0.0) + (f.volume or 0.0)

        origin = None
        for country, _ in sorted(origin_volumes.items(), key=lambda kv: (-kv[1], kv[0])):
            origin = _pick_asset(assets, country)
            if origin:
                break

        dest = None
        for country, _ in sorted(dest_volumes.items(), key=lambda kv: (-kv[1], kv[0])):
            dest = _pick_asset(assets, country)
            if dest:
                break

        if not origin or not dest or origin.id == dest.id:
            continue

        route_tokens = _significant_tokens(route.name)
        # The route's declared chokepoint FK (when the schema has one) is ground
        # truth and is always included, ahead of the name/corridor heuristics.
        declared_id = getattr(route, "chokepoint_id", None)
        matched = [
            cp for cp in chokepoints
            if cp.id == declared_id
            or (_significant_tokens(cp.name) & route_tokens)
            or _in_corridor(cp, origin, dest)
        ]
        # Order waypoints along the voyage by squared distance from the origin
        matched.sort(key=lambda cp: (cp.longitude - origin.longitude) ** 2 + (cp.latitude - origin.latitude) ** 2)

        path = [[origin.longitude, origin.latitude]]
        path += [[cp.longitude, cp.latitude] for cp in matched]
        path += [[dest.longitude, dest.latitude]]

        result[route.id] = {"path": path, "chokepoint_ids": [cp.id for cp in matched]}

    return result
