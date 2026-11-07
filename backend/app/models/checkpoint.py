"""Versioned artifact contract; validation is an explicit, checksum-bound decision."""
import hashlib
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CheckpointMetadata(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, protected_namespaces=())
    model_id: str = Field(min_length=1)
    model_version: str = Field(min_length=1)
    architecture: Literal['resnet50+cyclone-head-v1']
    class_mapping: list[str] = Field(min_length=2)
    training_dataset_version: str = Field(min_length=1)
    evaluation_dataset_version: str = Field(min_length=1)
    training_complete: bool
    scientifically_validated: bool
    checkpoint_checksum: str = Field(pattern=r'^[a-f0-9]{64}$')
    demo_model: bool
    model_status: Literal['UNCALIBRATED_DEMO', 'TRAINED_EXPERIMENTAL', 'VALIDATED']
    validation_reference: str | None = None

    @model_validator(mode='after')
    def consistent(self):
        if len(set(self.class_mapping)) != len(self.class_mapping):
            raise ValueError('Class mapping must be unique')
        if self.scientifically_validated and (self.demo_model or not self.training_complete or
                self.model_status != 'VALIDATED' or not self.validation_reference):
            raise ValueError('Validation requires completed non-demo training and independent evidence')
        if self.demo_model != (self.model_status == 'UNCALIBRATED_DEMO'):
            raise ValueError('Demo status must match the demo flag')
        if (self.model_status == 'VALIDATED') != self.scientifically_validated:
            raise ValueError('Validated status must match independently validated metadata')
        if not self.training_complete:
            raise ValueError('Incomplete training artifacts cannot be served')
        return self


def weights_checksum(state_dicts: dict) -> str:
    """Hash canonical tensor names, shapes, dtypes and bytes (no self-referential file hash)."""
    digest = hashlib.sha256()
    for group, tensors in sorted(state_dicts.items()):
        for name, tensor in sorted(tensors.items()):
            value = tensor.detach().cpu().contiguous()
            digest.update(f'{group}/{name}:{value.dtype}:{tuple(value.shape)}'.encode())
            digest.update(value.numpy().tobytes())
    return digest.hexdigest()
