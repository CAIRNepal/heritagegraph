import { redirect } from 'next/navigation';

// Landing page has been bypassed — app now loads directly into the dashboard.
// The original landing page code is preserved in `page.landing.tsx` for future use.
export default function Home() {
  redirect('/dashboard');
}
