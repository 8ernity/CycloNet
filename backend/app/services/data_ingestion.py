from sqlalchemy.orm import Session
from app.models.domain import CycloneArchive

def seed_historical_data(db: Session):
    """
    Seeds the SQLite database with historical IMD Best-Track data 
    (mocking the parsing of imdtrack / IBTrACS CSV datasets).
    """
    if db.query(CycloneArchive).first() is None:
        historical_systems = [
            CycloneArchive(id="BOB03-2020", name="Amphan", year=2020, basin="Bay of Bengal", max_category="Super Cyclonic Storm"),
            CycloneArchive(id="ARB01-2023", name="Biparjoy", year=2023, basin="Arabian Sea", max_category="Extremely Severe Cyclonic Storm"),
            CycloneArchive(id="BOB01-2021", name="Yaas", year=2021, basin="Bay of Bengal", max_category="Very Severe Cyclonic Storm"),
        ]
        db.add_all(historical_systems)
        db.commit()
        print("Database seeded with historical cyclone tracking data.")

def fetch_mosdac_latest_frame():
    """
    Mock function simulating a download of the latest INSAT-3D IR frame
    from MOSDAC API (ISRO).
    """
    print("Fetching latest IR frame from MOSDAC...")
    return True
