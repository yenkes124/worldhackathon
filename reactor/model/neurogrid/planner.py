"""Risk-weighted A*, naive unsafe route, path evaluation and the seeded learner.

Mirrors ``src/sim/planner.ts``. Iteration order, tie-breaking and floating-point
operation order are kept identical to the TypeScript so that paths, expansion
counts and episode scores are reproducible across both implementations.
"""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal

from .cell_meta import CELL_META
from .grid import cell_type_at, key, manhattan, same_cell
from .rng import mulberry32
from .types import LearnerResult, PathEvaluation, PlanResult, Vec3, Violation
from .world_model import legal_moves

RISK_WEIGHT = 2
LEARNER_EPISODES = 240
LEARNER_MAX_STEPS = 24


def to_fixed(value: float, digits: int = 3) -> float:
    """``Number(value.toFixed(digits))``: round-half-up on the exact binary value."""
    quant = Decimal(1).scaleb(-digits)
    return float(Decimal(value).quantize(quant, rounding=ROUND_HALF_UP))


def evaluate_path(path: list[Vec3] | tuple[Vec3, ...], target: Vec3) -> PathEvaluation:
    visited = list(path[1:])
    metas = [CELL_META[cell_type_at(position)] for position in visited]
    total_risk = 0.0
    total_reward = 0.0
    peak_risk = 0.0
    for meta in metas:
        total_risk = total_risk + meta.risk
        total_reward = total_reward + meta.reward
        peak_risk = max(peak_risk, meta.risk)
    return PathEvaluation(
        steps=max(len(path) - 1, 0),
        total_risk=to_fixed(total_risk),
        peak_risk=peak_risk,
        total_reward=to_fixed(total_reward),
        reaches_target=len(path) > 0 and same_cell(path[-1], target),
        violations=tuple(
            Violation(position=position, type=cell_type_at(position))
            for position in path
            if CELL_META[cell_type_at(position)].no_go
        ),
    )


def _empty_result(target: Vec3) -> PlanResult:
    return PlanResult(path=(), found=False, expanded=0, evaluation=evaluate_path([], target))


def plan_a_star(start: Vec3, target: Vec3) -> PlanResult:
    """Risk-weighted A*.

    No-go cells are filtered out by the world model before they ever enter the
    frontier, so they act as hard constraints rather than penalties.
    """
    if CELL_META[cell_type_at(start)].no_go:
        return _empty_result(target)

    start_key = key(start)
    came_from: dict[str, Vec3] = {}
    g_score: dict[str, float] = {start_key: 0}
    positions: dict[str, Vec3] = {start_key: start}
    # dict preserves insertion order like a JS Set, which matters for tie-breaks.
    open_set: dict[str, None] = {start_key: None}
    expanded = 0

    while open_set:
        current_key = ""
        best_score = math.inf
        for candidate in open_set:
            score = g_score.get(candidate, math.inf) + manhattan(positions[candidate], target)
            if score < best_score:
                best_score = score
                current_key = candidate

        current = positions[current_key]
        if same_cell(current, target):
            path: list[Vec3] = [current]
            cursor = current_key
            while cursor in came_from:
                previous = came_from[cursor]
                path.insert(0, previous)
                cursor = key(previous)
            return PlanResult(
                path=tuple(path),
                found=True,
                expanded=expanded,
                evaluation=evaluate_path(path, target),
            )

        del open_set[current_key]
        expanded += 1
        for move in legal_moves(current):
            neighbour_key = key(move.to)
            tentative = g_score.get(current_key, math.inf) + 1 + move.risk * RISK_WEIGHT
            if tentative < g_score.get(neighbour_key, math.inf):
                came_from[neighbour_key] = current
                g_score[neighbour_key] = tentative
                positions[neighbour_key] = move.to
                open_set[neighbour_key] = None

    return _empty_result(target)


def naive_unsafe_path(start: Vec3, target: Vec3) -> list[Vec3]:
    """The "shortest looking" route a naive planner would draw: x, then y, then z."""
    path: list[Vec3] = [start]
    cursor = [start[0], start[1], start[2]]
    for axis in (0, 1, 2):
        while cursor[axis] != target[axis]:
            cursor[axis] += 1 if cursor[axis] < target[axis] else -1
            path.append((cursor[0], cursor[1], cursor[2]))
    return path


def explain_failure(path: list[Vec3] | tuple[Vec3, ...], target: Vec3) -> str:
    evaluation = evaluate_path(path, target)
    violations = evaluation.violations
    if not violations:
        return (
            "This candidate happens to stay inside permitted tissue."
            if evaluation.reaches_target
            else "This candidate never reaches the target cell."
        )
    first = violations[0]
    meta = CELL_META[first.type]
    extra = ""
    if len(violations) > 1:
        plural = "s" if len(violations) > 2 else ""
        extra = f" and {len(violations) - 1} further no-go cell{plural}"
    coords = ", ".join(str(v) for v in first.position)
    return f"Rejected at [{coords}]: {meta.name}{extra}. {meta.description}"


def run_learner(
    start: Vec3,
    target: Vec3,
    seed: int,
    episodes: int = LEARNER_EPISODES,
) -> LearnerResult:
    """Seeded risk-averse rollouts that only use the world model's one-step predictions.

    Deterministic for a given seed; keeps the best safe trajectory it discovers.
    """
    random = mulberry32(seed)
    best: list[Vec3] = []
    best_score = -math.inf
    episode_scores: list[float] = []

    for episode in range(episodes):
        explore = max(0.05, 0.65 * (1 - episode / episodes))
        path: list[Vec3] = [start]
        seen = {key(start)}
        cursor = start
        score = 0.0
        for _ in range(LEARNER_MAX_STEPS):
            if same_cell(cursor, target):
                break
            options = [move for move in legal_moves(cursor) if key(move.to) not in seen]
            if not options:
                break
            scored = [
                (move, move.reward * 2 - move.risk - manhattan(move.to, target) * 0.5)
                for move in options
            ]
            scored.sort(key=lambda item: item[1], reverse=True)
            if random() < explore:
                chosen = scored[math.floor(random() * len(scored))]
            else:
                chosen = scored[0]
            cursor = chosen[0].to
            seen.add(key(cursor))
            path.append(cursor)
            score += chosen[0].reward - chosen[0].risk * 0.5

        reached = same_cell(cursor, target)
        episode_score = score + 5 - len(path) * 0.1 if reached else score - 5
        episode_scores.append(to_fixed(episode_score))
        if reached and episode_score > best_score:
            best_score = episode_score
            best = path

    return LearnerResult(
        path=tuple(best),
        found=len(best) > 0,
        expanded=episodes,
        episodes=episodes,
        episode_scores=tuple(episode_scores),
        evaluation=evaluate_path(best, target),
    )
