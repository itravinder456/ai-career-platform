"""add profile, social_links, experiences, projects, skills

Revision ID: 56771581f690
Revises:
Create Date: 2026-07-18 10:14:17.910018

Note: autogenerate also proposed dropping the checkpoint*/checkpoint_migrations
tables — those belong to LangGraph's AsyncPostgresSaver.setup() (services/runtime),
not to this service's SQLAlchemy metadata, so they were stripped from this
migration. Alembic only owns the five tables below.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '56771581f690'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('experiences',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('company', sa.String(length=200), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('location', sa.String(length=200), nullable=True),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=True),
    sa.Column('summary', sa.String(length=2000), nullable=True),
    sa.Column('achievements', postgresql.ARRAY(sa.String()), nullable=False),
    sa.Column('tech_stack', postgresql.ARRAY(sa.String()), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('profile',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('headline', sa.String(length=200), nullable=False),
    sa.Column('location', sa.String(length=200), nullable=False),
    sa.Column('email', sa.String(length=200), nullable=False),
    sa.Column('summary', sa.String(length=2000), nullable=True),
    sa.Column('resume_url', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('projects',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('slug', sa.String(length=200), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('summary', sa.String(length=500), nullable=False),
    sa.Column('description', sa.String(length=4000), nullable=True),
    sa.Column('tech_stack', postgresql.ARRAY(sa.String()), nullable=False),
    sa.Column('repo_url', sa.String(length=500), nullable=True),
    sa.Column('demo_url', sa.String(length=500), nullable=True),
    sa.Column('image_url', sa.String(length=500), nullable=True),
    sa.Column('featured', sa.Boolean(), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=True),
    sa.Column('end_date', sa.Date(), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('skills',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('social_links',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('platform', sa.String(length=50), nullable=False),
    sa.Column('label', sa.String(length=100), nullable=False),
    sa.Column('url', sa.String(length=500), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # ── Seed data — the profile singleton row + Ravinder's real links ──────────
    op.execute(
        """
        INSERT INTO profile (id, name, headline, location, email, summary, resume_url)
        VALUES (
            1,
            'Ravinder Varikuppala',
            'Senior AI Platform Engineer',
            'Hyderabad, India',
            'it.ravinder.456@gmail.com',
            NULL,
            '/resume'
        )
        """
    )
    op.execute(
        """
        INSERT INTO social_links (platform, label, url, display_order) VALUES
        ('github', 'GitHub', 'https://github.com/itravinder456', 0),
        ('linkedin', 'LinkedIn', 'https://www.linkedin.com/in/varikuppala-ravinder/', 1),
        ('resume', 'Resume', '/resume', 2)
        """
    )


def downgrade() -> None:
    op.drop_table('social_links')
    op.drop_table('skills')
    op.drop_table('projects')
    op.drop_table('profile')
    op.drop_table('experiences')
