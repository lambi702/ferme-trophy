import { redirect } from 'next/navigation'

export default function OldQrRedirect() {
  redirect('/qrcodes')
}
