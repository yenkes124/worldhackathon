"""Seeded PRNG. Bit-exact port of ``mulberry32`` from ``src/sim/rng.ts``.

JavaScript's ``Math.imul`` and ``>>>`` operate on 32-bit integers; the helpers
below reproduce that wrap-around so the same seed yields the same sequence.
"""

from __future__ import annotations

from typing import Callable

_MASK32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """``Math.imul``: 32-bit signed multiply, returned as a signed int32."""
    product = (a & _MASK32) * (b & _MASK32) & _MASK32
    return product - (1 << 32) if product & 0x80000000 else product


def _to_uint32(value: int) -> int:
    return value & _MASK32


def _to_int32(value: int) -> int:
    value &= _MASK32
    return value - (1 << 32) if value & 0x80000000 else value


def _ushr(value: int, bits: int) -> int:
    return _to_uint32(value) >> bits


def mulberry32(seed: int) -> Callable[[], float]:
    state = _to_uint32(seed)

    def next_value() -> float:
        nonlocal state
        state = _to_uint32(state + 0x6D2B79F5)
        t = state
        t = _imul(t ^ _ushr(t, 15), _to_int32(t | 1))
        t = _to_int32(t ^ _to_int32(t + _imul(t ^ _ushr(t, 7), _to_int32(t | 61))))
        return _ushr(t ^ _ushr(t, 14), 0) / 4294967296

    return next_value
