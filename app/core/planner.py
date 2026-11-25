"""
OLA Builder Agent v0.1 - Planner Module

Workflow planning and execution strategy.
"""

from typing import Dict, Any, List
from app.logging.logger import get_logger

logger = get_logger(__name__)


class WorkflowPlanner:
    """
    Plans and structures workflow execution.
    """
    
    @staticmethod
    def create_requirement_workflow(requirement_text: str) -> Dict[str, Any]:
        """
        Create workflow for requirement analysis.
        
        Args:
            requirement_text: Requirement description
            
        Returns:
            Workflow configuration
        """
        return {
            "name": "Requirement Analysis Workflow",
            "steps": [
                {
                    "agent": "requirement",
                    "data": {
                        "requirement_text": requirement_text,
                    },
                },
            ],
        }
    
    @staticmethod
    def create_planning_workflow(
        requirements: Dict[str, Any],
        project_name: str,
    ) -> Dict[str, Any]:
        """
        Create workflow for architecture planning.
        
        Args:
            requirements: Analyzed requirements
            project_name: Project name
            
        Returns:
            Workflow configuration
        """
        return {
            "name": "Architecture Planning Workflow",
            "steps": [
                {
                    "agent": "planner",
                    "data": {
                        "requirements": requirements,
                        "project_name": project_name,
                    },
                },
            ],
        }
    
    @staticmethod
    def create_build_workflow(plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create workflow for code generation.
        
        Args:
            plan: Architecture plan
            
        Returns:
            Workflow configuration
        """
        modules = plan.get("modules", [])
        steps = []
        
        for module in modules:
            steps.append({
                "agent": "code",
                "data": {
                    "module_name": module.get("name"),
                    "module_type": module.get("type", "generic"),
                    "description": module.get("description"),
                },
            })
        
        return {
            "name": "Code Generation Workflow",
            "steps": steps,
        }
    
    @staticmethod
    def create_test_workflow(modules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create workflow for test generation.
        
        Args:
            modules: Generated modules
            
        Returns:
            Workflow configuration
        """
        steps = []
        
        for module in modules:
            steps.append({
                "agent": "test",
                "data": {
                    "module_name": module.get("name"),
                    "module_code": module.get("code", ""),
                    "test_type": "unit",
                },
            })
        
        return {
            "name": "Test Generation Workflow",
            "steps": steps,
        }
    
    @staticmethod
    def create_review_workflow(modules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create workflow for code review.
        
        Args:
            modules: Generated modules
            
        Returns:
            Workflow configuration
        """
        steps = []
        
        for module in modules:
            steps.append({
                "agent": "review",
                "data": {
                    "module_name": module.get("name"),
                    "code": module.get("code", ""),
                },
            })
        
        return {
            "name": "Code Review Workflow",
            "steps": steps,
        }
    
    @staticmethod
    def create_documentation_workflow(modules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create workflow for documentation generation.
        
        Args:
            modules: Generated modules
            
        Returns:
            Workflow configuration
        """
        steps = []
        
        for module in modules:
            steps.append({
                "agent": "documentation",
                "data": {
                    "module_name": module.get("name"),
                    "doc_type": "readme",
                    "description": module.get("description", ""),
                },
            })
        
        return {
            "name": "Documentation Workflow",
            "steps": steps,
        }
