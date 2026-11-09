"""Keep public API startup independent of optional, heavyweight inference imports."""
import importlib
import sys


class DeferredInference:
    @staticmethod
    def _service():
        # Python's import lock initializes the existing singleton once. Callers
        # reach this only inside the inference budget or explicit model startup.
        return importlib.import_module('app.services.ml_service').ml_service

    @staticmethod
    def _loaded_service():
        module = sys.modules.get('app.services.ml_service')
        return getattr(module, 'ml_service', None) if module else None

    @property
    def checkpoint_loaded(self):
        return bool(getattr(self._loaded_service(), 'checkpoint_loaded', False))

    @property
    def scientifically_validated(self):
        return bool(getattr(self._loaded_service(), 'scientifically_validated', False))

    def load_model(self):
        return self._service().load_model()

    def predict(self, image_bytes):
        return self._service().predict(image_bytes)


ml_service = DeferredInference()
