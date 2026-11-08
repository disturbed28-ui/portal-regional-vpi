interface ParticipantePresenca {
  id: string;
  presencaId: string;
  isExterno?: boolean;
}

// External visitors have an attendance ID, never a member ID.
export function acaoRemoverParticipante(participante: ParticipantePresenca) {
  return participante.isExterno
    ? { action: 'delete_presenca' as const, presenca_id: participante.presencaId }
    : { action: 'remove' as const, integrante_id: participante.id };
}