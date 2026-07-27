"""add chat_sessions

Revision ID: a1c2f3d4e5b6
Revises: 98c797969bcf
Create Date: 2026-07-28 00:00:00.000000

Session-level metadata for the admin "Conversations" view. No user name or
IP address by design — the actual message transcript lives in
services/runtime's LangGraph checkpointer (checkpoint*/checkpoint_migrations
tables in this same database), not here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c2f3d4e5b6'
down_revision: Union[str, Sequence[str], None] = '98c797969bcf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('chat_sessions',
    sa.Column('session_id', sa.String(length=128), nullable=False),
    sa.Column('message_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('first_message_preview', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('session_id')
    )


def downgrade() -> None:
    op.drop_table('chat_sessions')
