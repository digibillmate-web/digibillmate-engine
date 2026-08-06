import Link from 'next/link';

/**
 * What still stands between this site and being live.
 *
 * Computed from the site's actual state rather than ticked off by hand: a
 * checklist someone maintains is a checklist that lies. Every item here is
 * derived, so it cannot claim a site has hosting when no project exists.
 *
 * Deliberately short. It answers "what is left?", not "what did we do?" — a
 * twenty-item audit gets skimmed, and the two or three genuinely blocking
 * items get lost among the satisfied ones.
 */

export interface ChecklistItem {
  label: string;
  done: boolean;
  /** Why it matters, shown only while outstanding. */
  hint: string;
  href?: string;
  /** Cannot be done from this portal — shown as guidance, never as a failure. */
  manual?: boolean;
}

export default function LaunchChecklist({ items }: { items: ChecklistItem[] }) {
  const blocking = items.filter((item) => !item.done && !item.manual);
  const manual = items.filter((item) => !item.done && item.manual);
  const done = items.filter((item) => item.done).length;

  return (
    <section className="card settings-card">
      <h2 className="settings-card__title">Launch checklist</h2>
      <p className="settings-card__hint">
        {blocking.length === 0
          ? manual.length === 0
            ? 'Everything this portal can check is done.'
            : `Ready. ${manual.length} step${manual.length === 1 ? '' : 's'} happen outside this portal.`
          : `${blocking.length} step${blocking.length === 1 ? '' : 's'} left · ${done} of ${items.length} done`}
      </p>

      <ul className="checklist">
        {items.map((item) => (
          <li
            key={item.label}
            className={`checklist__item ${item.done ? 'is-done' : ''} ${
              item.manual ? 'is-manual' : ''
            }`}
          >
            <span className="checklist__mark" aria-hidden="true">
              {item.done ? '✓' : item.manual ? '·' : '○'}
            </span>

            <span className="checklist__body">
              <span className="checklist__label">
                {item.href && !item.done ? <Link href={item.href}>{item.label}</Link> : item.label}
                {item.manual && !item.done && <span className="checklist__tag">outside</span>}
              </span>

              {/* Hidden once satisfied: an explanation of something already
                  handled is noise on every future visit. */}
              {!item.done && <span className="checklist__hint">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
