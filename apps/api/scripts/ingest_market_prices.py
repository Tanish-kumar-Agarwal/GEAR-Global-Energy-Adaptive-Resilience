"""
Ingest commodity price observations into PostgreSQL.

    python scripts/ingest_market_prices.py            # live fetch, falls back to reference file
    python scripts/ingest_market_prices.py --offline  # reference file only

Safe to run repeatedly: observations are keyed by source + symbol + observation time.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from services.market_ingestion import (
    MarketPriceIngestionService,
    ReferenceFileAdapter,
    YahooChartAdapter,
)

REFERENCE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "db",
    "seeds",
    "market_reference_prices.json",
)


def main():
    parser = argparse.ArgumentParser(description="Ingest commodity prices")
    parser.add_argument("--offline", action="store_true", help="Skip the live feed, use the reference file")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if not args.offline:
            stats = MarketPriceIngestionService(db, YahooChartAdapter()).run()
            if stats["fetched"] > 0:
                print(f"Live feed: fetched={stats['fetched']} inserted={stats['inserted']} duplicates={stats['duplicates']}")
                return
            print("Live feed returned nothing, falling back to reference file.")

        stats = MarketPriceIngestionService(db, ReferenceFileAdapter(REFERENCE_FILE)).run()
        print(f"Reference file: fetched={stats['fetched']} inserted={stats['inserted']} duplicates={stats['duplicates']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
