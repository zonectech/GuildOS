import Link from 'next/link';

export function ClassicUnavailable({ requestedPath }: { requestedPath?: string }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="rounded-full bg-mist px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-muted">Page not moved yet</p>
      <h1 className="mt-5 text-[32px] font-extrabold tracking-tight">This page isn’t available here yet</h1>
      <p className="mt-3 text-[15px] leading-6 text-muted">
        {requestedPath ? <>The page <span className="font-semibold text-ink">{requestedPath}</span> still belongs to the previous site.</> : 'This page still belongs to the previous site.'}
        {' '}The previous site address has not been set up for this environment. Please try again later or return to events.
      </p>
      <Link href="/events" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-bold text-white transition hover:opacity-90">
        Browse events
      </Link>
    </section>
  );
}
