from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import UUID


@dataclass
class Negotiation:
    id: UUID
    position_id: UUID
    party: str
    proposed_value: float
    status: str  # "pending", "accepted", "rejected", "countered"
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class Position:
    id: UUID
    title: str
    value: float
    created_at: datetime


# In-memory store (replace with DB layer as needed)
_positions: dict[UUID, Position] = {}
_negotiations: dict[UUID, list[Negotiation]] = {}


def get_negotiations_for_position(position_id: UUID) -> list[Negotiation]:
    """Return all negotiations associated with the given position."""
    if position_id not in _positions:
        raise KeyError(f"Position {position_id} not found")
    return list(_negotiations.get(position_id, []))


def add_position(position: Position) -> None:
    _positions[position.id] = position


def add_negotiation(negotiation: Negotiation) -> None:
    _negotiations.setdefault(negotiation.position_id, []).append(negotiation)
