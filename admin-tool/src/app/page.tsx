import { redirect } from 'next/navigation';

export default function Home() {
  // Middleware decides where an unauthenticated visitor ends up.
  redirect('/sites');
}
