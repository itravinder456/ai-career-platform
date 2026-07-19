"""add profile_stats

Revision ID: bc5a6210f862
Revises: 56771581f690
Create Date: 2026-07-19 21:47:53.298107

Note: autogenerate also proposed dropping the checkpoint*/checkpoint_migrations
tables — those belong to LangGraph's AsyncPostgresSaver.setup() (services/runtime),
not to this service's SQLAlchemy metadata, so they were stripped from this
migration, same as 56771581f690.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'bc5a6210f862'
down_revision: Union[str, Sequence[str], None] = '56771581f690'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('profile_stats',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('label', sa.String(length=100), nullable=False),
    sa.Column('value', sa.String(length=50), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # Seed with the values currently hardcoded in frontend/src/components/landing/Hero.tsx —
    # this migration is what lets Hero.tsx stop hardcoding them.
    op.execute(
        """
        INSERT INTO profile_stats (label, value, display_order) VALUES
        ('Years AI/ML', '6+', 0),
        ('Systems Shipped', '10+', 1),
        ('LLM Frameworks', '3', 2)
        """
    )


def downgrade() -> None:
    op.drop_table('profile_stats')
