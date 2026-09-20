"""
Database migration: Upgrade recovery_scores table.

Adds new columns to recovery_scores:
  - risk_probability (Float)
  - is_anomaly (Boolean)
  - recommendation (Text)
  - model_version (String)
  
Renames:
  - score -> prototype_recovery_score

Run with:
  cd backend
  python migrate_recovery_scores.py
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text, inspect
from app.core.database import engine, Base
from app.models import monitoring  # noqa: ensure models registered

def run_migration():
    inspector = inspect(engine)
    existing_cols = [c["name"] for c in inspector.get_columns("recovery_scores")]
    
    with engine.connect() as conn:
        # Rename score -> prototype_recovery_score (if old column exists)
        if "score" in existing_cols and "prototype_recovery_score" not in existing_cols:
            print("Renaming column: score -> prototype_recovery_score")
            conn.execute(text(
                "ALTER TABLE recovery_scores RENAME COLUMN score TO prototype_recovery_score"
            ))
        
        # Add risk_probability
        if "risk_probability" not in existing_cols:
            print("Adding column: risk_probability")
            conn.execute(text(
                "ALTER TABLE recovery_scores ADD COLUMN risk_probability FLOAT"
            ))
        
        # Add is_anomaly
        if "is_anomaly" not in existing_cols:
            print("Adding column: is_anomaly")
            conn.execute(text(
                "ALTER TABLE recovery_scores ADD COLUMN is_anomaly BOOLEAN DEFAULT FALSE"
            ))
        
        # Add recommendation
        if "recommendation" not in existing_cols:
            print("Adding column: recommendation")
            conn.execute(text(
                "ALTER TABLE recovery_scores ADD COLUMN recommendation TEXT"
            ))
        
        # Add model_version
        if "model_version" not in existing_cols:
            print("Adding column: model_version")
            conn.execute(text(
                "ALTER TABLE recovery_scores ADD COLUMN model_version VARCHAR(50)"
            ))
        
        conn.commit()
        print("\nMigration complete!")
        
        # Verify final columns
        final_cols = [c["name"] for c in inspect(engine).get_columns("recovery_scores")]
        print(f"recovery_scores columns: {final_cols}")


if __name__ == "__main__":
    run_migration()
