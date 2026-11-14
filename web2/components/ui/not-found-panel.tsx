import { Stamp } from '@/components/brand/stamp';
import { Btn } from '@/components/ui/bits';

/**
 * "There's nothing here": the 404 page, and pages whose link points at something that doesn't
 * exist (an event or community that was removed, a mistyped address). Always offers a way on.
 */
export function NotFoundPanel({ title = 'This page doesn’t exist', body = 'The link may be old or mistyped.', href = '/events', label = 'Browse events', secondary }: {
  title?: string; body?: string; href?: string; label?: string; secondary?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Stamp state="empty" label="Nothing here" size={120} tilt={-8} title="Nothing here" />
      <h1 className="text-[30px] font-extrabold">{title}</h1>
      <p className="text-[15.5px] text-muted">{body}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Btn href={href}>{label}</Btn>
        {secondary ? <Btn kind="secondary" href={secondary.href}>{secondary.label}</Btn> : null}
      </div>
    </div>
  );
}
