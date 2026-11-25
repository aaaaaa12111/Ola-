"""
OLA Builder Agent v0.1 - Configuration Module

Loads and validates configuration from environment variables.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application Settings"""
    
    # Application
    app_name: str = "OLA Builder Agent"
    app_version: str = "0.1.0"
    debug: bool = True
    log_level: str = "INFO"
    
    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    
    # Database
    database_url: str = "sqlite:///./ola_builder.db"
    
    # Storage
    storage_path: str = "./data"
    memory_backend: str = "sqlite"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    
    # Agents
    enable_requirement_agent: bool = True
    enable_planner_agent: bool = True
    enable_code_agent: bool = True
    enable_test_agent: bool = True
    enable_review_agent: bool = True
    enable_docs_agent: bool = True
    
    # Logging
    log_format: str = "json"
    log_file: str = "./logs/ola_builder.log"
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **data):
        super().__init__(**data)
        # Create necessary directories
        os.makedirs(self.storage_path, exist_ok=True)
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)


# Global settings instance
settings = Settings()
