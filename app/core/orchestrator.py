"""
OLA Builder Agent v0.1 - Builder Orchestrator

Central orchestrator that coordinates all agents.
Manages workflow execution, state, and communication between agents.
"""

from typing import Dict, Any, Optional, List
from app.agents.base import AgentInput, AgentOutput, BaseAgent
from app.agents.requirement_agent import RequirementAgent
from app.agents.planner_agent import PlannerAgent
from app.agents.code_agent import CodeAgent
from app.agents.test_agent import TestAgent
from app.agents.review_agent import ReviewAgent
from app.agents.docs_agent import DocumentationAgent
from app.memory.storage import MemoryStorage
from app.memory.database import SessionLocal
from app.logging.logger import get_logger
import uuid
from datetime import datetime

logger = get_logger(__name__)


class BuilderOrchestrator:
    """
    Central orchestrator managing all agents and workflow execution.
    
    Coordinates:
    - Agent initialization
    - Workflow execution
    - State management
    - Data flow between agents
    - Session management
    """
    
    def __init__(self):
        """Initialize orchestrator with all agents."""
        self.id = str(uuid.uuid4())
        self.logger = logger
        
        # Initialize database session and storage
        self.db = SessionLocal()
        self.storage = MemoryStorage(self.db)
        
        # Initialize agents
        self.agents: Dict[str, BaseAgent] = {
            "requirement": RequirementAgent(storage=self.storage),
            "planner": PlannerAgent(storage=self.storage),
            "code": CodeAgent(storage=self.storage),
            "test": TestAgent(storage=self.storage),
            "review": ReviewAgent(storage=self.storage),
            "documentation": DocumentationAgent(storage=self.storage),
        }
        
        self.session_id: Optional[str] = None
        self.workflow_history: List[Dict[str, Any]] = []
        
        self.logger.info(
            "orchestrator_initialized",
            orchestrator_id=self.id,
            agents_count=len(self.agents),
        )
    
    def create_session(self, name: str, description: str = "") -> str:
        """
        Create new build session.
        
        Args:
            name: Session name
            description: Session description
            
        Returns:
            Session ID
        """
        session = self.storage.create_session(name, description)
        self.session_id = session.id
        
        self.logger.info(
            "session_created",
            session_id=self.session_id,
            name=name,
        )
        
        return self.session_id
    
    def get_session_info(self) -> Dict[str, Any]:
        """
        Get current session information.
        
        Returns:
            Session details
        """
        if not self.session_id:
            return {"error": "No active session"}
        
        session = self.storage.get_session(self.session_id)
        if not session:
            return {"error": "Session not found"}
        
        return {
            "id": session.id,
            "name": session.name,
            "status": session.status,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
        }
    
    def get_agent_info(self, agent_name: str) -> Dict[str, Any]:
        """
        Get agent information.
        
        Args:
            agent_name: Agent name
            
        Returns:
            Agent details
        """
        agent = self.agents.get(agent_name)
        if not agent:
            return {"error": f"Agent '{agent_name}' not found"}
        
        return agent.get_info()
    
    def list_agents(self) -> Dict[str, Dict[str, Any]]:
        """
        List all available agents.
        
        Returns:
            Dictionary of agent information
        """
        return {name: agent.get_info() for name, agent in self.agents.items()}
    
    def execute_workflow(self, workflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute complete workflow.
        
        Args:
            workflow_config: Workflow configuration
            
        Returns:
            Workflow results
        """
        if not self.session_id:
            return {"error": "No active session. Create one first."}
        
        self.logger.info(
            "workflow_execution_start",
            session_id=self.session_id,
            steps=len(workflow_config.get("steps", [])),
        )
        
        workflow_results = {
            "session_id": self.session_id,
            "workflow_id": str(uuid.uuid4()),
            "steps": [],
            "status": "completed",
            "errors": [],
        }
        
        steps = workflow_config.get("steps", [])
        
        for step in steps:
            try:
                step_result = self.execute_step(step)
                workflow_results["steps"].append(step_result)
                
                if not step_result.get("success"):
                    workflow_results["status"] = "failed"
                    workflow_results["errors"].append(step_result.get("error"))
                    
            except Exception as e:
                error_msg = f"Step execution failed: {str(e)}"
                self.logger.error("step_execution_error", error=error_msg)
                workflow_results["errors"].append(error_msg)
                workflow_results["status"] = "failed"
        
        # Update session status
        self.storage.update_session_status(
            self.session_id,
            "completed" if workflow_results["status"] == "completed" else "failed"
        )
        
        self.logger.info(
            "workflow_execution_complete",
            session_id=self.session_id,
            status=workflow_results["status"],
        )
        
        return workflow_results
    
    def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute single workflow step.
        
        Args:
            step: Step configuration
            
        Returns:
            Step results
        """
        agent_name = step.get("agent")
        task_id = str(uuid.uuid4())
        data = step.get("data", {})
        
        self.logger.info(
            "step_execution_start",
            agent_name=agent_name,
            task_id=task_id,
        )
        
        # Get agent
        agent = self.agents.get(agent_name)
        if not agent:
            return {
                "success": False,
                "error": f"Agent '{agent_name}' not found",
            }
        
        # Prepare input
        input_data = AgentInput(
            session_id=self.session_id,
            task_id=task_id,
            data=data,
        )
        
        # Execute agent
        output = agent.execute_safe(input_data)
        
        # Store step result
        step_result = {
            "step_id": str(uuid.uuid4()),
            "agent": agent_name,
            "task_id": task_id,
            "success": output.success,
            "duration_ms": output.duration_ms,
            "data": output.data,
            "error": output.error,
        }
        
        self.workflow_history.append(step_result)
        
        return step_result
    
    def get_workflow_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get workflow execution history.
        
        Args:
            limit: Maximum number of records
            
        Returns:
            Workflow history
        """
        return self.workflow_history[-limit:]
    
    def reset_session(self) -> None:
        """
        Reset current session.
        """
        self.session_id = None
        self.workflow_history = []
        
        # Reset all agents
        for agent in self.agents.values():
            agent.reset()
        
        self.logger.info("session_reset")
    
    def close(self) -> None:
        """
        Close orchestrator and cleanup resources.
        """
        if self.db:
            self.db.close()
        
        self.logger.info(
            "orchestrator_closed",
            orchestrator_id=self.id,
        )
