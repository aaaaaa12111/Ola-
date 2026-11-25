"""
OLA Builder Agent v0.1 - Reviewer Module

Code review coordination and quality management.
"""

from typing import Dict, Any, List
from app.logging.logger import get_logger

logger = get_logger(__name__)


class QualityReviewer:
    """
    Coordinates code review and quality assurance.
    """
    
    @staticmethod
    def prepare_review_queue(
        generated_modules: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Prepare review queue for modules.
        
        Args:
            generated_modules: Modules to review
            
        Returns:
            Review queue
        """
        queue = []
        
        for module in generated_modules:
            queue.append({
                "module_name": module.get("name"),
                "code": module.get("code"),
                "priority": module.get("priority", "medium"),
                "status": "pending",
            })
        
        logger.info(
            "review_queue_prepared",
            queue_size=len(queue),
        )
        
        return queue
    
    @staticmethod
    def aggregate_reviews(
        review_results: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Aggregate review results.
        
        Args:
            review_results: Individual review results
            
        Returns:
            Aggregated review report
        """
        total_issues = 0
        total_score = 0.0
        issues_by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for result in review_results:
            summary = result.get("summary", {})
            total_issues += summary.get("total_issues", 0)
            total_score += result.get("score", 0)
        
        avg_score = total_score / len(review_results) if review_results else 0
        
        report = {
            "total_modules_reviewed": len(review_results),
            "total_issues": total_issues,
            "average_score": round(avg_score, 2),
            "overall_status": "pass" if avg_score >= 70 else "needs_improvement",
            "issues_by_severity": issues_by_severity,
            "details": review_results,
        }
        
        logger.info(
            "reviews_aggregated",
            modules_reviewed=len(review_results),
            total_issues=total_issues,
            average_score=avg_score,
        )
        
        return report
