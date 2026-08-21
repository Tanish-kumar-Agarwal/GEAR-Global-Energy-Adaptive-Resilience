"""Self-healing guard for schema drift on the shared dev database.

The routes.chokepoint_ids column has twice been dropped out from under the
running stack by stray migration downgrades run elsewhere. create_all() never
re-adds columns to an existing table, so the API would otherwise serve
DATABASE_UNAVAILABLE for every routes query until someone intervenes. This
guard turns that failure mode into a few seconds of startup work: re-add the
column, re-derive the backfill, and log loudly so the drift is still seen.
"""

import logging

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)


def ensure_route_geometry_schema(engine, session_factory):
    try:
        columns = {c["name"] for c in inspect(engine).get_columns("routes")}
    except Exception:
        # Table missing entirely; create_all owns that case.
        return
    if not columns or "chokepoint_ids" in columns:
        return

    logger.warning(
        "SCHEMA SELF-HEAL: routes.chokepoint_ids is missing (stray migration "
        "downgrade against the shared database?). Re-adding the column and "
        "re-running the backfill."
    )
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE routes ADD COLUMN IF NOT EXISTS chokepoint_ids JSON"))
            conn.commit()
    except Exception:
        logger.exception("SCHEMA SELF-HEAL: failed to re-add routes.chokepoint_ids")
        return

    from models.domain import Route
    from services.route_geometry import derive_route_geometries

    db = session_factory()
    try:
        geometries = derive_route_geometries(db)
        healed = 0
        for route in db.query(Route).all():
            if route.chokepoint_ids is not None:
                continue
            geo = geometries.get(route.id)
            if geo and geo["chokepoint_ids"]:
                route.chokepoint_ids = geo["chokepoint_ids"]
            elif getattr(route, "chokepoint_id", None):
                route.chokepoint_ids = [route.chokepoint_id]
            else:
                continue
            healed += 1
        db.commit()
        logger.warning("SCHEMA SELF-HEAL: backfilled chokepoint_ids for %d routes.", healed)
    except Exception:
        logger.exception("SCHEMA SELF-HEAL: backfill failed; column exists but is empty")
        db.rollback()
    finally:
        db.close()
