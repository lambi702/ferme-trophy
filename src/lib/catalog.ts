/** Effet toujours signé selon le type : bonus > 0, malus < 0 (au moins 1 tour). */
export function signedEffect(type: 'BONUS_SELF' | 'MALUS_OTHER', lapEffect: unknown) {
  const magnitude = Math.max(1, Math.abs(Math.trunc(Number(lapEffect)) || 1))
  return type === 'BONUS_SELF' ? magnitude : -magnitude
}
