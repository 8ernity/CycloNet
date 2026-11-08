import React from 'react';
import {currentObservation, type VerifiedAttribute} from '@/lib/infrastructureData';

export function ObservationValue({attribute, now}: {attribute?:VerifiedAttribute<string|number|boolean>;now?:number}) {
  const value=currentObservation(attribute,now);
  if(value==null) return <span>Unavailable</span>;
  return <span><strong>{String(value)}</strong><small className="block text-xs text-muted-foreground">
    Source: {attribute!.source} · Verified: <time>{attribute!.verified_at}</time> · Expires: <time>{attribute!.expires_at}</time>
  </small></span>;
}
