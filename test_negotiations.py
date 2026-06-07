import pytest
from datetime import datetime, timezone
from uuid import uuid4

from negotiations import (
    Negotiation,
    Position,
    add_negotiation,
    add_position,
    get_negotiations_for_position,
    _positions,
    _negotiations,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.fixture(autouse=True)
def clear_store():
    _positions.clear()
    _negotiations.clear()
    yield
    _positions.clear()
    _negotiations.clear()


def make_position(**kwargs) -> Position:
    defaults = dict(id=uuid4(), title="Senior Engineer", value=150_000.0, created_at=_now())
    return Position(**{**defaults, **kwargs})


def make_negotiation(position_id, **kwargs) -> Negotiation:
    defaults = dict(
        id=uuid4(),
        position_id=position_id,
        party="Candidate A",
        proposed_value=160_000.0,
        status="pending",
        notes=None,
        created_at=_now(),
        updated_at=_now(),
    )
    return Negotiation(**{**defaults, **kwargs})


def test_returns_empty_list_when_no_negotiations():
    pos = make_position()
    add_position(pos)
    assert get_negotiations_for_position(pos.id) == []


def test_returns_negotiations_for_position():
    pos = make_position()
    add_position(pos)
    neg1 = make_negotiation(pos.id, proposed_value=155_000.0)
    neg2 = make_negotiation(pos.id, proposed_value=160_000.0, status="countered")
    add_negotiation(neg1)
    add_negotiation(neg2)

    result = get_negotiations_for_position(pos.id)
    assert len(result) == 2
    assert neg1 in result
    assert neg2 in result


def test_does_not_return_negotiations_for_other_positions():
    pos1, pos2 = make_position(), make_position()
    add_position(pos1)
    add_position(pos2)
    neg = make_negotiation(pos2.id)
    add_negotiation(neg)

    assert get_negotiations_for_position(pos1.id) == []


def test_raises_for_unknown_position():
    with pytest.raises(KeyError, match="not found"):
        get_negotiations_for_position(uuid4())


def test_returns_copy_not_original_list():
    pos = make_position()
    add_position(pos)
    result = get_negotiations_for_position(pos.id)
    result.append(make_negotiation(pos.id))
    assert get_negotiations_for_position(pos.id) == []
