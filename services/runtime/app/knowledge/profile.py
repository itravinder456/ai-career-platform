"""
Identity-only static knowledge about Ravinder Varikuppala — name, location, contact.
Deliberately does NOT include career facts (experience, skills, projects, education):
those come from RAG retrieval only (app/tools/retrieval.py), against the real resume
indexed in Qdrant by services/ingestion — never from static/hardcoded data.
"""

PROFILE = """
NAME: Ravinder Varikuppala
LOCATION: Hyderabad, India
EMAIL: it.ravinder.456@gmail.com
GITHUB: https://github.com/itravinder456
LINKEDIN: https://linkedin.com/in/ravinder-varikuppala
"""
