from sqlalchemy.orm import Session
from app.models.domain import CycloneArchive

def seed_historical_data(db: Session):
    """
    Seeds the SQLite database with comprehensive historical IMD Best-Track data
    across Bay of Bengal and Arabian Sea basins (1999–2024).
    """
    historical_systems = [
        # 2024 Season
        {"id": "BOB09-2024", "name": "Fengal", "year": 2024, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "27 Nov - 01 Dec 2024"},
        {"id": "BOB04-2024", "name": "Dana", "year": 2024, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "22 Oct - 26 Oct 2024"},
        {"id": "ARB01-2024", "name": "Asna", "year": 2024, "basin": "Arabian Sea", "max_category": "Cyclonic Storm", "dates": "25 Aug - 02 Sep 2024"},
        {"id": "BOB01-2024", "name": "Remal", "year": 2024, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "24 May - 28 May 2024"},
        
        # 2023 Season
        {"id": "BOB06-2023", "name": "Michaung", "year": 2023, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "01 Dec - 06 Dec 2023"},
        {"id": "BOB07-2023", "name": "Midhili", "year": 2023, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "15 Nov - 18 Nov 2023"},
        {"id": "BOB05-2023", "name": "Hamoon", "year": 2023, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "21 Oct - 25 Oct 2023"},
        {"id": "ARB02-2023", "name": "Tej", "year": 2023, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "20 Oct - 24 Oct 2023"},
        {"id": "ARB01-2023", "name": "Biparjoy", "year": 2023, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "06 Jun - 19 Jun 2023"},
        {"id": "BOB02-2023", "name": "Mocha", "year": 2023, "basin": "Bay of Bengal", "max_category": "Extremely Severe Cyclonic Storm", "dates": "09 May - 15 May 2023"},
        
        # 2022 Season
        {"id": "BOB09-2022", "name": "Mandous", "year": 2022, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "06 Dec - 10 Dec 2022"},
        {"id": "BOB05-2022", "name": "Sitrang", "year": 2022, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "22 Oct - 25 Oct 2022"},
        {"id": "BOB01-2022", "name": "Asani", "year": 2022, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "07 May - 12 May 2022"},
        
        # 2021 Season
        {"id": "BOB05-2021", "name": "Jawad", "year": 2021, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "02 Dec - 06 Dec 2021"},
        {"id": "ARB02-2021", "name": "Shaheen", "year": 2021, "basin": "Arabian Sea", "max_category": "Severe Cyclonic Storm", "dates": "29 Sep - 04 Oct 2021"},
        {"id": "BOB04-2021", "name": "Gulab", "year": 2021, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "24 Sep - 28 Sep 2021"},
        {"id": "BOB01-2021", "name": "Yaas", "year": 2021, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "23 May - 28 May 2021"},
        {"id": "ARB01-2021", "name": "Tauktae", "year": 2021, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "14 May - 19 May 2021"},
        
        # 2020 Season
        {"id": "BOB05-2020", "name": "Burevi", "year": 2020, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "30 Nov - 05 Dec 2020"},
        {"id": "BOB04-2020", "name": "Nivar", "year": 2020, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "23 Nov - 27 Nov 2020"},
        {"id": "ARB02-2020", "name": "Nisarga", "year": 2020, "basin": "Arabian Sea", "max_category": "Severe Cyclonic Storm", "dates": "01 Jun - 04 Jun 2020"},
        {"id": "BOB03-2020", "name": "Amphan", "year": 2020, "basin": "Bay of Bengal", "max_category": "Super Cyclonic Storm", "dates": "16 May - 21 May 2020"},
        
        # 2019 Season
        {"id": "BOB04-2019", "name": "Bulbul", "year": 2019, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "05 Nov - 11 Nov 2019"},
        {"id": "ARB04-2019", "name": "Maha", "year": 2019, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "30 Oct - 07 Nov 2019"},
        {"id": "ARB03-2019", "name": "Kyarr", "year": 2019, "basin": "Arabian Sea", "max_category": "Super Cyclonic Storm", "dates": "24 Oct - 03 Nov 2019"},
        {"id": "ARB02-2019", "name": "Hikka", "year": 2019, "basin": "Arabian Sea", "max_category": "Very Severe Cyclonic Storm", "dates": "22 Sep - 25 Sep 2019"},
        {"id": "ARB01-2019", "name": "Vayu", "year": 2019, "basin": "Arabian Sea", "max_category": "Very Severe Cyclonic Storm", "dates": "10 Jun - 17 Jun 2019"},
        {"id": "BOB02-2019", "name": "Fani", "year": 2019, "basin": "Bay of Bengal", "max_category": "Extremely Severe Cyclonic Storm", "dates": "26 Apr - 04 May 2019"},
        {"id": "BOB01-2019", "name": "Pabuk", "year": 2019, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "04 Jan - 08 Jan 2019"},
        
        # 2018 Season
        {"id": "BOB07-2018", "name": "Gaja", "year": 2018, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "10 Nov - 19 Nov 2018"},
        {"id": "BOB08-2018", "name": "Titli", "year": 2018, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "08 Oct - 12 Oct 2018"},
        {"id": "ARB04-2018", "name": "Luban", "year": 2018, "basin": "Arabian Sea", "max_category": "Very Severe Cyclonic Storm", "dates": "06 Oct - 15 Oct 2018"},
        {"id": "ARB01-2018", "name": "Sagar", "year": 2018, "basin": "Arabian Sea", "max_category": "Cyclonic Storm", "dates": "16 May - 20 May 2018"},
        {"id": "ARB02-2018", "name": "Mekunu", "year": 2018, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "21 May - 27 May 2018"},
        
        # Historic Landmarks (2007–2017)
        {"id": "ARB05-2017", "name": "Ockhi", "year": 2017, "basin": "Arabian Sea", "max_category": "Very Severe Cyclonic Storm", "dates": "29 Nov - 06 Dec 2017"},
        {"id": "BOB02-2017", "name": "Mora", "year": 2017, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "28 May - 31 May 2017"},
        {"id": "BOB06-2016", "name": "Vardah", "year": 2016, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "06 Dec - 13 Dec 2016"},
        {"id": "ARB04-2015", "name": "Chapala", "year": 2015, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "28 Oct - 04 Nov 2015"},
        {"id": "ARB05-2015", "name": "Megh", "year": 2015, "basin": "Arabian Sea", "max_category": "Extremely Severe Cyclonic Storm", "dates": "05 Nov - 10 Nov 2015"},
        {"id": "BOB03-2014", "name": "Hudhud", "year": 2014, "basin": "Bay of Bengal", "max_category": "Extremely Severe Cyclonic Storm", "dates": "07 Oct - 14 Oct 2014"},
        {"id": "BOB04-2013", "name": "Phailin", "year": 2013, "basin": "Bay of Bengal", "max_category": "Extremely Severe Cyclonic Storm", "dates": "08 Oct - 14 Oct 2013"},
        {"id": "BOB02-2012", "name": "Nilam", "year": 2012, "basin": "Bay of Bengal", "max_category": "Cyclonic Storm", "dates": "28 Oct - 01 Nov 2012"},
        {"id": "BOB05-2011", "name": "Thane", "year": 2011, "basin": "Bay of Bengal", "max_category": "Very Severe Cyclonic Storm", "dates": "25 Dec - 31 Dec 2011"},
        {"id": "BOB02-2009", "name": "Aila", "year": 2009, "basin": "Bay of Bengal", "max_category": "Severe Cyclonic Storm", "dates": "23 May - 26 May 2009"},
        {"id": "BOB01-2008", "name": "Nargis", "year": 2008, "basin": "Bay of Bengal", "max_category": "Extremely Severe Cyclonic Storm", "dates": "27 Apr - 03 May 2008"},
        {"id": "ARB01-2007", "name": "Gonu", "year": 2007, "basin": "Arabian Sea", "max_category": "Super Cyclonic Storm", "dates": "01 Jun - 07 Jun 2007"},
        {"id": "BOB04-2007", "name": "Sidr", "year": 2007, "basin": "Bay of Bengal", "max_category": "Super Cyclonic Storm", "dates": "11 Nov - 16 Nov 2007"},
        {"id": "BOB06-1999", "name": "Odisha Super Cyclone", "year": 1999, "basin": "Bay of Bengal", "max_category": "Super Cyclonic Storm", "dates": "25 Oct - 04 Nov 1999"},
    ]
    
    # Ensure 'dates' column exists if SQLite table was created previously without it
    try:
        from sqlalchemy import text
        db.execute(text("ALTER TABLE cyclone_archive ADD COLUMN dates VARCHAR"))
        db.commit()
    except Exception:
        db.rollback()

    for item in historical_systems:
        existing = db.query(CycloneArchive).filter_by(id=item["id"]).first()
        if not existing:
            db.add(CycloneArchive(**item))
        else:
            # Update fields including dates if already present
            existing.dates = item.get("dates")
            existing.name = item.get("name")
            existing.basin = item.get("basin")
            existing.max_category = item.get("max_category")
            existing.year = item.get("year")
    
    db.commit()
    print(f"Database seeded: {len(historical_systems)} historical cyclones in catalog.")

def fetch_mosdac_latest_frame():
    """
    Mock function simulating a download of the latest INSAT-3D IR frame
    from MOSDAC API (ISRO).
    """
    print("Fetching latest IR frame from MOSDAC...")
    return True
