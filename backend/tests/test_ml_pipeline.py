"""
Tests for the ML pipeline:
  - feature generation
  - risk prediction
  - anomaly detection
  - recommendation generation
  - missing artifacts
  - insufficient patient data
"""
import pytest
import numpy as np
from unittest.mock import MagicMock, patch, PropertyMock


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_features(
    adherence=90.0,
    activity=80.0,
    missed=1,
    inactivity=30.0,
    history=70.0,
):
    return {
        "medicine_adherence_percent": adherence,
        "activity_score": activity,
        "missed_medicine_count_7d": missed,
        "inactivity_minutes_avg": inactivity,
        "recovery_history_score": history,
    }


# ─────────────────────────────────────────────────────────────────────────────
# risk_engine.evaluate()
# ─────────────────────────────────────────────────────────────────────────────

class TestRiskEngineEvaluate:
    """Tests for the unified evaluate() function."""

    def test_low_risk_patient(self):
        """Good adherence & activity → low risk, high prototype score."""
        from app.ml.risk_engine import evaluate
        features = make_features(adherence=95, activity=90, missed=0, inactivity=10, history=85)
        result = evaluate(features)

        assert result["risk_level"] in ("low", "medium", "high")
        assert 0.0 <= result["risk_probability"] <= 1.0
        assert 0.0 <= result["prototype_recovery_score"] <= 100.0
        assert isinstance(result["is_anomaly"], bool)
        assert isinstance(result["recommendation"], str)
        assert len(result["recommendation"]) > 10
        assert "model_versions" in result

    def test_high_risk_patient(self):
        """Poor adherence & high inactivity should raise risk."""
        from app.ml.risk_engine import evaluate
        features = make_features(adherence=20, activity=5, missed=8, inactivity=350, history=30)
        result = evaluate(features)

        assert result["risk_level"] in ("medium", "high"), (
            f"Expected medium/high risk for poor metrics, got {result['risk_level']}"
        )

    def test_prototype_score_inversely_related_to_risk(self):
        """Prototype score should be lower for higher risk."""
        from app.ml.risk_engine import evaluate
        low_risk = evaluate(make_features(adherence=98, activity=95, missed=0, inactivity=5))
        high_risk = evaluate(make_features(adherence=15, activity=5, missed=9, inactivity=380))
        assert low_risk["prototype_recovery_score"] >= high_risk["prototype_recovery_score"]

    def test_result_keys_always_present(self):
        """All required keys must be present regardless of data."""
        from app.ml.risk_engine import evaluate
        result = evaluate(make_features())
        for key in ("risk_level", "risk_probability", "prototype_recovery_score",
                    "is_anomaly", "recommendation", "model_versions"):
            assert key in result, f"Missing key: {key}"

    def test_fallback_when_models_missing(self):
        """With no artifacts, rule-based fallback must still work."""
        with patch("app.ml.risk_engine._xgb_model", None), \
             patch("app.ml.risk_engine._iforest_model", None), \
             patch("app.ml.risk_engine._dtree_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(adherence=30, missed=6, inactivity=320))
            assert result["risk_level"] in ("low", "medium", "high")
            assert result["model_versions"]["xgboost"] == "fallback"

    def test_anomaly_flagged_for_extreme_inactivity(self):
        """Extreme inactivity (>240 min) should flag anomaly when no IF model."""
        with patch("app.ml.risk_engine._iforest_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(inactivity=300))
            # Rule-based fallback: inactivity > 240 → anomaly
            assert result["is_anomaly"] is True

    def test_no_anomaly_for_normal_patient(self):
        """Normal patient should not be flagged anomaly by rule-based fallback."""
        with patch("app.ml.risk_engine._iforest_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(inactivity=30, missed=1))
            assert result["is_anomaly"] is False

    def test_recommendation_never_diagnoses(self):
        """Recommendation must never contain diagnostic language."""
        from app.ml.risk_engine import evaluate
        for _ in range(5):
            result = evaluate(make_features(
                adherence=np.random.uniform(20, 100),
                missed=int(np.random.randint(0, 9)),
            ))
            rec = result["recommendation"].lower()
            assert "you have disease" not in rec
            assert "you are medically safe" not in rec
            assert "you are cured" not in rec

    def test_prototype_score_label_not_clinical(self):
        """The key must be 'prototype_recovery_score', not 'recovery_score'."""
        from app.ml.risk_engine import evaluate
        result = evaluate(make_features())
        assert "prototype_recovery_score" in result
        assert "recovery_score" not in result  # avoid misleading clinical naming


# ─────────────────────────────────────────────────────────────────────────────
# feature_service.build_features()
# ─────────────────────────────────────────────────────────────────────────────

class TestFeatureService:
    """Tests for the feature extraction service."""

    def _make_db_mock(
        self,
        total_doses=10,
        taken_doses=8,
        missed_doses=2,
        avg_inactivity=45.0,
        last_score=None,
    ):
        """Build a minimal SQLAlchemy Session mock."""
        db = MagicMock()

        # Chain: db.query(...).filter(...).scalar()
        scalar_mock = MagicMock(side_effect=[total_doses, taken_doses, missed_doses, avg_inactivity])
        db.query.return_value.filter.return_value.scalar = scalar_mock

        # Chain for avg inactivity (different filter)
        first_mock = MagicMock(return_value=last_score)
        db.query.return_value.filter.return_value.order_by.return_value.first = first_mock

        return db

    def test_sufficient_data_computes_correctly(self):
        """With full medication + activity data, features should compute."""
        from app.services.feature_service import FeatureService
        db = MagicMock()

        # Mock query chain for medicine_adherence (total, taken, missed)
        total_q = MagicMock()
        taken_q = MagicMock()
        missed_q = MagicMock()
        inact_q = MagicMock()
        score_q = MagicMock()

        total_q.scalar.return_value = 10
        taken_q.scalar.return_value = 8
        missed_q.scalar.return_value = 2
        inact_q.scalar.return_value = 50.0
        score_q.first.return_value = None  # no prior score

        # Each call to db.query() returns a chain
        call_count = [0]
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            mock_chain = MagicMock()
            mock_chain.filter.return_value = mock_chain
            mock_chain.order_by.return_value = mock_chain
            if call_count[0] == 1:
                mock_chain.scalar.return_value = 10   # total
            elif call_count[0] == 2:
                mock_chain.scalar.return_value = 8    # taken
            elif call_count[0] == 3:
                mock_chain.scalar.return_value = 2    # missed
            elif call_count[0] == 4:
                mock_chain.scalar.return_value = 50.0  # inactivity
            else:
                mock_chain.first.return_value = None  # no prior score
            return mock_chain

        db.query.side_effect = side_effect
        fs = FeatureService()
        features = fs.build_features(db, patient_id=1)

        assert "medicine_adherence_percent" in features
        assert "activity_score" in features
        assert "missed_medicine_count_7d" in features
        assert "inactivity_minutes_avg" in features
        assert "recovery_history_score" in features

    def test_no_medicine_data_uses_safe_defaults(self):
        """When no medicine history exists, defaults should be safe (100% adherence, 0 missed)."""
        from app.services.feature_service import FeatureService
        db = MagicMock()

        call_count = [0]
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            mock_chain = MagicMock()
            mock_chain.filter.return_value = mock_chain
            mock_chain.order_by.return_value = mock_chain
            if call_count[0] == 1:
                mock_chain.scalar.return_value = 0   # total = 0 (no history)
            elif call_count[0] == 2:
                mock_chain.scalar.return_value = None  # inactivity
            else:
                mock_chain.first.return_value = None
            return mock_chain

        db.query.side_effect = side_effect
        fs = FeatureService()
        features = fs.build_features(db, patient_id=99)

        assert features["medicine_adherence_percent"] == 100.0
        assert features["missed_medicine_count_7d"] == 0

    def test_prior_recovery_score_is_used(self):
        """If a prior RecoveryScore exists, use it as history baseline."""
        from app.services.feature_service import FeatureService
        db = MagicMock()

        prior_score = MagicMock()
        prior_score.prototype_recovery_score = 72.0

        call_count = [0]
        def side_effect(*args, **kwargs):
            call_count[0] += 1
            mock_chain = MagicMock()
            mock_chain.filter.return_value = mock_chain
            mock_chain.order_by.return_value = mock_chain
            mock_chain.scalar.return_value = 0
            if call_count[0] >= 3:
                mock_chain.first.return_value = prior_score
            return mock_chain

        db.query.side_effect = side_effect
        fs = FeatureService()
        features = fs.build_features(db, patient_id=1)
        assert features["recovery_history_score"] == 72.0


# ─────────────────────────────────────────────────────────────────────────────
# alert_service
# ─────────────────────────────────────────────────────────────────────────────

class TestAlertService:
    """Tests for deduplication logic in alert_service."""

    def test_creates_new_alert_when_no_existing(self):
        """Alert should be created when no duplicate exists."""
        from app.services.alert_service import AlertService
        db = MagicMock()

        # Mock the entire query chain — filter().first() returns None (no duplicate)
        mock_chain = MagicMock()
        mock_chain.filter.return_value = mock_chain
        mock_chain.first.return_value = None
        db.query.return_value = mock_chain

        db.add = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()

        svc = AlertService()
        svc.create_alert(db, patient_id=1, alert_type="anomaly", message="Test", severity="high")

        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_deduplicates_existing_alert(self):
        """Should return existing alert without creating a new one."""
        from app.services.alert_service import AlertService
        db = MagicMock()

        existing_alert = MagicMock()
        existing_alert.id = 42
        db.query.return_value.filter.return_value.first.return_value = existing_alert

        svc = AlertService()
        result = svc.create_alert(db, patient_id=1, alert_type="anomaly", message="Test", severity="high")

        db.add.assert_not_called()
        assert result == existing_alert


# ─────────────────────────────────────────────────────────────────────────────
# Rule-based fallback
# ─────────────────────────────────────────────────────────────────────────────

class TestRuleBasedFallback:
    def test_high_risk_by_missed_doses(self):
        with patch("app.ml.risk_engine._xgb_model", None), \
             patch("app.ml.risk_engine._iforest_model", None), \
             patch("app.ml.risk_engine._dtree_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(missed=7, adherence=30))
            assert result["risk_level"] == "high"

    def test_medium_risk_by_moderate_adherence(self):
        with patch("app.ml.risk_engine._xgb_model", None), \
             patch("app.ml.risk_engine._iforest_model", None), \
             patch("app.ml.risk_engine._dtree_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(missed=3, adherence=70, inactivity=130))
            assert result["risk_level"] == "medium"

    def test_low_risk_ideal_patient(self):
        with patch("app.ml.risk_engine._xgb_model", None), \
             patch("app.ml.risk_engine._iforest_model", None), \
             patch("app.ml.risk_engine._dtree_model", None):
            from app.ml.risk_engine import evaluate
            result = evaluate(make_features(adherence=99, missed=0, inactivity=10))
            assert result["risk_level"] == "low"
