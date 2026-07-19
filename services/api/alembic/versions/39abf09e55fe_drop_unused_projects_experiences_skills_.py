"""drop unused projects experiences skills tables

Revision ID: 39abf09e55fe
Revises: bc5a6210f862
Create Date: 2026-07-19 23:26:33.459290

Career facts (projects/experience/skills) come from RAG over services/ingestion's
data/ documents, not from structured admin-edited rows — these tables were never
read by anything except their own now-deleted admin CRUD routes, so they're
dropped here. Only profile/social_links/profile_stats remain, since those genuinely
back the landing page and runtime's system prompt. As always, the checkpoint*
tables autogenerate proposed dropping belong to LangGraph, not this migration —
stripped, same as every prior revision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '39abf09e55fe'
down_revision: Union[str, Sequence[str], None] = 'bc5a6210f862'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('projects')
    op.drop_table('experiences')
    op.drop_table('skills')


def downgrade() -> None:
    op.create_table('skills',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('category', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('display_order', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('skills_pkey'))
    )
    op.create_table('experiences',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('company', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('title', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('location', sa.VARCHAR(length=200), autoincrement=False, nullable=True),
    sa.Column('start_date', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('end_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('summary', sa.VARCHAR(length=2000), autoincrement=False, nullable=True),
    sa.Column('achievements', postgresql.ARRAY(sa.VARCHAR()), autoincrement=False, nullable=False),
    sa.Column('tech_stack', postgresql.ARRAY(sa.VARCHAR()), autoincrement=False, nullable=False),
    sa.Column('display_order', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('experiences_pkey'))
    )
    op.create_table('projects',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('slug', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('name', sa.VARCHAR(length=200), autoincrement=False, nullable=False),
    sa.Column('summary', sa.VARCHAR(length=500), autoincrement=False, nullable=False),
    sa.Column('description', sa.VARCHAR(length=4000), autoincrement=False, nullable=True),
    sa.Column('tech_stack', postgresql.ARRAY(sa.VARCHAR()), autoincrement=False, nullable=False),
    sa.Column('repo_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('demo_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('image_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True),
    sa.Column('featured', sa.BOOLEAN(), autoincrement=False, nullable=False),
    sa.Column('start_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('end_date', sa.DATE(), autoincrement=False, nullable=True),
    sa.Column('display_order', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.Column('updated_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('projects_pkey')),
    sa.UniqueConstraint('slug', name=op.f('projects_slug_key'))
    )
