"""
OLA Builder Agent v0.1 - Storage Module

Memory storage interface for persistent data access.
"""

from sqlalchemy.orm import Session
from app.memory.models import (
    BuildSession, Requirement, Plan, CodeModule, 
    TestResult, ReviewRecord, DocumentRecord, AgentAction
)
from typing import List, Optional
import uuid
from datetime import datetime


class MemoryStorage:
    """High-level storage interface."""
    
    def __init__(self, db: Session):
        self.db = db
    
    # BuildSession operations
    def create_session(self, name: str, description: Optional[str] = None) -> BuildSession:
        """Create new build session."""
        session = BuildSession(
            id=str(uuid.uuid4()),
            name=name,
            description=description
        )
        self.db.add(session)
        self.db.commit()
        return session
    
    def get_session(self, session_id: str) -> Optional[BuildSession]:
        """Get session by ID."""
        return self.db.query(BuildSession).filter(BuildSession.id == session_id).first()
    
    def list_sessions(self, limit: int = 10) -> List[BuildSession]:
        """List recent sessions."""
        return self.db.query(BuildSession).order_by(BuildSession.created_at.desc()).limit(limit).all()
    
    def update_session_status(self, session_id: str, status: str) -> None:
        """Update session status."""
        session = self.get_session(session_id)
        if session:
            session.status = status
            session.updated_at = datetime.utcnow()
            self.db.commit()
    
    # Requirement operations
    def create_requirement(self, session_id: str, title: str, description: str, 
                          priority: str = "medium") -> Requirement:
        """Create new requirement."""
        req = Requirement(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=title,
            description=description,
            priority=priority
        )
        self.db.add(req)
        self.db.commit()
        return req
    
    def get_requirements(self, session_id: str) -> List[Requirement]:
        """Get all requirements for session."""
        return self.db.query(Requirement).filter(Requirement.session_id == session_id).all()
    
    # Plan operations
    def create_plan(self, session_id: str, title: str, content: str, modules: dict) -> Plan:
        """Create new plan."""
        plan = Plan(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=title,
            content=content,
            modules=modules
        )
        self.db.add(plan)
        self.db.commit()
        return plan
    
    def get_plan(self, plan_id: str) -> Optional[Plan]:
        """Get plan by ID."""
        return self.db.query(Plan).filter(Plan.id == plan_id).first()
    
    # CodeModule operations
    def create_code_module(self, session_id: str, name: str, path: str, 
                          content: str, language: str = "python") -> CodeModule:
        """Create new code module."""
        module = CodeModule(
            id=str(uuid.uuid4()),
            session_id=session_id,
            name=name,
            path=path,
            content=content,
            language=language
        )
        self.db.add(module)
        self.db.commit()
        return module
    
    def get_code_modules(self, session_id: str) -> List[CodeModule]:
        """Get all code modules for session."""
        return self.db.query(CodeModule).filter(CodeModule.session_id == session_id).all()
    
    # TestResult operations
    def create_test_result(self, session_id: str, test_name: str, passed: bool, 
                          output: Optional[str] = None, duration: Optional[int] = None) -> TestResult:
        """Create new test result."""
        result = TestResult(
            id=str(uuid.uuid4()),
            session_id=session_id,
            test_name=test_name,
            passed=passed,
            output=output,
            duration=duration
        )
        self.db.add(result)
        self.db.commit()
        return result
    
    def get_test_results(self, session_id: str) -> List[TestResult]:
        """Get all test results for session."""
        return self.db.query(TestResult).filter(TestResult.session_id == session_id).all()
    
    # ReviewRecord operations
    def create_review(self, session_id: str, module_id: Optional[str], 
                     status: str = "pending", comments: Optional[str] = None) -> ReviewRecord:
        """Create new review record."""
        review = ReviewRecord(
            id=str(uuid.uuid4()),
            session_id=session_id,
            module_id=module_id,
            status=status,
            comments=comments
        )
        self.db.add(review)
        self.db.commit()
        return review
    
    def get_reviews(self, session_id: str) -> List[ReviewRecord]:
        """Get all reviews for session."""
        return self.db.query(ReviewRecord).filter(ReviewRecord.session_id == session_id).all()
    
    # DocumentRecord operations
    def create_document(self, session_id: str, title: str, content: str, 
                       doc_type: str = "md", path: Optional[str] = None) -> DocumentRecord:
        """Create new document record."""
        doc = DocumentRecord(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=title,
            content=content,
            doc_type=doc_type,
            path=path
        )
        self.db.add(doc)
        self.db.commit()
        return doc
    
    def get_documents(self, session_id: str) -> List[DocumentRecord]:
        """Get all documents for session."""
        return self.db.query(DocumentRecord).filter(DocumentRecord.session_id == session_id).all()
    
    # AgentAction operations
    def log_agent_action(self, session_id: str, agent_name: str, action: str,
                        input_data: dict = None, status: str = "pending") -> AgentAction:
        """Log agent action."""
        action_log = AgentAction(
            id=str(uuid.uuid4()),
            session_id=session_id,
            agent_name=agent_name,
            action=action,
            input_data=input_data,
            status=status
        )
        self.db.add(action_log)
        self.db.commit()
        return action_log
    
    def update_agent_action(self, action_id: str, status: str, 
                           output_data: dict = None, error: Optional[str] = None) -> None:
        """Update agent action status."""
        action = self.db.query(AgentAction).filter(AgentAction.id == action_id).first()
        if action:
            action.status = status
            action.output_data = output_data
            action.error = error
            self.db.commit()
