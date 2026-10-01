import { redirect } from 'next/navigation'

// Ancienne URL (QR codes déjà imprimés ?) → le live est maintenant sur l'accueil.
export default function ClassementRedirect() {
  redirect('/')
}
