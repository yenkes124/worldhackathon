"""Port of ``src/sim/simulation.test.ts`` plus cross-implementation parity checks."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from neurogrid.cell_meta import CELL_META
from neurogrid.grid import GRID_SIZE, build_grid, cell_type_at, in_bounds, same_cell
from neurogrid.planner import (
    evaluate_path,
    explain_failure,
    naive_unsafe_path,
    plan_a_star,
    run_learner,
)
from neurogrid.rng import mulberry32
from neurogrid.scenario import RIGHT_HAND_TREMOR, VIM_TARGET_POSITION
from neurogrid.world_model import ACTIONS, action_by_id, predict_transition

FIXTURE = Path(__file__).parent / "fixtures" / "ts_reference.json"


class TestGridBounds:
    def test_accepts_every_in_volume_coordinate(self):
        cells = build_grid()
        assert len(cells) == GRID_SIZE**3
        assert all(in_bounds(cell.position) for cell in cells)

    def test_rejects_coordinates_outside_the_volume(self):
        outside = [
            (-1, 0, 0),
            (0, -1, 0),
            (0, 0, -1),
            (4, 0, 0),
            (0, 4, 0),
            (0, 0, 4),
            (1.5, 1, 1),
        ]
        for position in outside:
            assert in_bounds(position) is False
            assert cell_type_at(position) == "OUTSIDE"


class TestTransitionPrediction:
    def test_is_deterministic_and_additive(self):
        start = (1, 1, 2)
        first = predict_transition(start, action_by_id("Z_NEG"))
        second = predict_transition(start, action_by_id("Z_NEG"))
        assert first.to == (1, 1, 1)
        assert first == second
        assert first.predicted_type == "VIM_TARGET"
        assert first.allowed is True

    def test_predicts_outside_instead_of_wrapping(self):
        prediction = predict_transition((0, 0, 3), action_by_id("Z_POS"))
        assert prediction.in_bounds is False
        assert prediction.predicted_type == "OUTSIDE"
        assert prediction.allowed is False

    def test_reports_risk_and_reward_for_every_action(self):
        for action in ACTIONS:
            prediction = predict_transition((1, 1, 2), action)
            assert prediction.risk == CELL_META[prediction.predicted_type].risk
            assert prediction.reward == CELL_META[prediction.predicted_type].reward


class TestNoGoConstraints:
    NO_GO_TYPES = [
        "IC_AVOID",
        "VENT_AVOID",
        "BRAINSTEM_AVOID",
        "CEREB_NET",
        "OUTSIDE",
        "SENS",
        "MOT_LEG",
        "MOT_TRUNK",
        "MOT_ARM",
        "MOT_HAND",
        "MOT_FACE",
    ]

    def test_marks_every_forbidden_tissue_class_as_hard_constraint(self):
        for cell_type in self.NO_GO_TYPES:
            assert CELL_META[cell_type].no_go is True

    def test_never_routes_a_plan_through_a_no_go_cell(self):
        for entry in RIGHT_HAND_TREMOR.entries:
            plan = plan_a_star(entry, VIM_TARGET_POSITION)
            assert plan.found is True
            assert len(plan.evaluation.violations) == 0

    def test_refuses_to_plan_from_a_forbidden_start_cell(self):
        plan = plan_a_star((1, 1, 3), VIM_TARGET_POSITION)
        assert plan.found is False
        assert len(plan.path) == 0


class TestTargetReachability:
    def test_reaches_target_from_every_entry_with_contiguous_steps(self):
        assert len(RIGHT_HAND_TREMOR.entries) > 0
        for entry in RIGHT_HAND_TREMOR.entries:
            result = plan_a_star(entry, VIM_TARGET_POSITION)
            assert same_cell(result.path[0], entry)
            assert result.evaluation.reaches_target is True
            for previous, current in zip(result.path, result.path[1:]):
                delta = sum(abs(current[i] - previous[i]) for i in range(3))
                assert delta == 1

    def test_is_deterministic_across_repeated_runs(self):
        entry = RIGHT_HAND_TREMOR.entries[0]
        assert plan_a_star(entry, VIM_TARGET_POSITION).path == (
            plan_a_star(entry, VIM_TARGET_POSITION).path
        )


class TestFailedCandidateRoute:
    def test_crosses_hand_motor_cortex_and_is_explained(self):
        entry = RIGHT_HAND_TREMOR.entries[0]
        path = naive_unsafe_path(entry, VIM_TARGET_POSITION)
        evaluation = evaluate_path(path, VIM_TARGET_POSITION)
        assert evaluation.reaches_target is True
        assert len(evaluation.violations) > 0
        assert "Rejected at" in explain_failure(path, VIM_TARGET_POSITION)


class TestLearnerDemo:
    def test_finds_safe_trajectory_and_is_reproducible(self):
        entry = RIGHT_HAND_TREMOR.entries[0]
        first = run_learner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed)
        second = run_learner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed)
        assert first.found is True
        assert len(first.evaluation.violations) == 0
        assert first.evaluation.reaches_target is True
        assert second.path == first.path


@pytest.fixture(scope="module")
def ts_reference() -> dict:
    return json.loads(FIXTURE.read_text())


def _as_tuples(path: list[list[int]]) -> tuple[tuple[int, int, int], ...]:
    return tuple(tuple(point) for point in path)


class TestParityWithTypeScript:
    """The Python port must reproduce the original ``src/sim`` outputs exactly."""

    def test_scenario_constants(self, ts_reference):
        assert RIGHT_HAND_TREMOR.seed == ts_reference["seed"]
        assert list(VIM_TARGET_POSITION) == ts_reference["target"]
        assert [list(e) for e in RIGHT_HAND_TREMOR.entries] == ts_reference["entries"]

    def test_grid_layout(self, ts_reference):
        expected = {tuple(pos): cell_type for pos, cell_type in ts_reference["grid"]}
        assert {cell.position: cell.type for cell in build_grid()} == expected

    def test_rng_sequence(self, ts_reference):
        rng = mulberry32(ts_reference["seed"])
        assert [rng() for _ in range(16)] == ts_reference["rngFirst16"]

    def test_a_star_results(self, ts_reference):
        for entry, expected in zip(RIGHT_HAND_TREMOR.entries, ts_reference["aStar"]):
            plan = plan_a_star(entry, VIM_TARGET_POSITION)
            assert plan.path == _as_tuples(expected["path"])
            assert plan.expanded == expected["expanded"]
            assert plan.evaluation.total_risk == expected["evaluation"]["totalRisk"]
            assert plan.evaluation.total_reward == expected["evaluation"]["totalReward"]
            assert plan.evaluation.peak_risk == expected["evaluation"]["peakRisk"]

    def test_naive_unsafe_paths(self, ts_reference):
        for entry, expected in zip(RIGHT_HAND_TREMOR.entries, ts_reference["naiveUnsafe"]):
            assert tuple(naive_unsafe_path(entry, VIM_TARGET_POSITION)) == _as_tuples(expected)

    def test_learner_results(self, ts_reference):
        for entry, expected in zip(RIGHT_HAND_TREMOR.entries, ts_reference["learner"]):
            result = run_learner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed)
            assert result.path == _as_tuples(expected["path"])
            assert list(result.episode_scores) == expected["episodeScores"]
            assert result.evaluation.total_risk == expected["evaluation"]["totalRisk"]
