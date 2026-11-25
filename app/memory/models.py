"""
OLA Builder Agent v0.1 - Memory Models

SQLAlchemy models for persistent storage.
"""

from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from typing import Optional

Base = declarative_base()


class BuildSession(Base):
    """Build session record."""
    
    __tablename__ = "build_sessions"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<BuildSession {self.id}>"


class Requirement(Base):
    """Requirement record."""
    
    __tablename__ = "requirements"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(50), default="medium")
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Requirement {self.id}>"


class Plan(Base):
    """Architecture plan record."""
    
    __tablename__ = "plans"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    modules = Column(JSON, nullable=True)
    status = Column(String(50), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Plan {self.id}>"


class CodeModule(Base):
    """Generated code module record."""
    
    __tablename__ = "code_modules"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    plan_id = Column(String(36), nullable=True)
    name = Column(String(255), nullable=False)
    path = Column(String(512), nullable=False)
    language = Column(String(50), default="python")
    content = Column(Text, nullable=False)
    status = Column(String(50), default="generated")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<CodeModule {self.id}>"


class TestResult(Base):
    """Test execution record."""
    
    __tablename__ = "test_results"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    module_id = Column(String(36), nullable=True)
    test_name = Column(String(255), nullable=False)
    passed = Column(Boolean, default=False)
    output = Column(Text, nullable=True)
    duration = Column(Integer, nullable=True)  # milliseconds
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<TestResult {self.id}>"


class ReviewRecord(Base):
    """Code review record."""
    
    __tablename__ = "review_records"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    module_id = Column(String(36), nullable=True)
    reviewer = Column(String(50), default="ReviewAgent")
    status = Column(String(50), default="pending")  # pending, approved, rejected, needs_revision
    comments = Column(Text, nullable=True)
    issues = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<ReviewRecord {self.id}>"


class DocumentRecord(Base):
    """Generated documentation record."""
    
    __tablename__ = "document_records"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    title = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="md")  # md, rst, html
    content = Column(Text, nullable=False)
    path = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DocumentRecord {self.id}>"


class AgentAction(Base):
    """Agent action log."""
    
    __tablename__ = "agent_actions"
    
    id = Column(String(36), primary_key=True)
    session_id = Column(String(36), nullable=False)
    agent_name = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    status = Column(String(50), default="pending")  # pending, success, failed
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<AgentAction {self.id}>"
