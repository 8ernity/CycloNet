"""Explicit runtime mode: a hosted service cannot inherit local defaults."""
import os


def runtime_environment():
    value = os.getenv('ENVIRONMENT', 'development')
    if value not in {'development', 'test', 'production'}:
        raise RuntimeError('ENVIRONMENT must be development, test, or production')
    if os.getenv('RENDER', '').lower() == 'true' and value != 'production':
        raise RuntimeError('Render requires explicit ENVIRONMENT=production, including staging')
    return value
