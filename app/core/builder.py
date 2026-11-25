"""
OLA Builder Agent v0.1 - Builder Module

Core building and code generation coordination.
"""

from typing import Dict, Any, List
from app.logging.logger import get_logger

logger = get_logger(__name__)


class CodeBuilder:
    """
    Coordinates code generation and building.
    """
    
    @staticmethod
    def prepare_module_spec(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Prepare module specifications from plan.
        
        Args:
            plan: Architecture plan
            
        Returns:
            Module specifications
        """
        modules = plan.get("modules", [])
        spec_list = []
        
        for module in modules:
            spec = {
                "name": module.get("name"),
                "type": module.get("type"),
                "description": module.get("description"),
                "files": module.get("files", []),
                "priority": module.get("priority", "medium"),
            }
            spec_list.append(spec)
        
        logger.info(
            "module_specs_prepared",
            module_count=len(spec_list),
        )
        
        return spec_list
    
    @staticmethod
    def organize_modules(
        generated_modules: List[Dict[str, Any]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Organize generated modules by type.
        
        Args:
            generated_modules: Generated modules
            
        Returns:
            Organized modules by category
        """
        organized = {
            "api": [],
            "core": [],
            "models": [],
            "services": [],
            "other": [],
        }
        
        for module in generated_modules:
            module_type = module.get("type", "other")
            
            if module_type in organized:
                organized[module_type].append(module)
            else:
                organized["other"].append(module)
        
        logger.info(
            "modules_organized",
            organization={
                k: len(v) for k, v in organized.items()
            },
        )
        
        return organized
