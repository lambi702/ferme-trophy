import { redirect } from 'next/navigation'

// Ancienne URL → l'onglet "Écuries" de la direction de course.
export default function OrganisateurEquipesRedirect() {
  redirect('/organisateur?tab=ecuries')
}
