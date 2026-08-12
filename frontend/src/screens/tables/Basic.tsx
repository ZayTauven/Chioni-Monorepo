/*
 * Vireo Next.js — Basic Tables (tables/basic). Faithful port of
 * src/html/tables/basic.html: default / striped+hover / bordered / compact /
 * contextual-rows / responsive+totals variants on the .ax-table primitive.
 * Purely static — server component (PageHead is its own client boundary).
 */
import { PageHead } from '../../components/shell/PageHead';

const DATA_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5a8 3 0 1 0 16 0a8 3 0 1 0 -16 0" /><path d="M3 5v6a8 3 0 0 0 16 0v-6" /><path d="M3 11v6a8 3 0 0 0 16 0v-6" /></svg>
);
const EXPORT_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
);

const strong = { fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' } as const;
const muted = { color: 'var(--ax-text-muted)' } as const;
const numStrong = { color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' } as const;
const mono = { fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' } as const;

function AvatarInitials({ tone, initials }: { tone: string; initials: string }) {
  return (
    <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,var(--ax-viz-${tone}) 18%,var(--ax-surface-solid))`, color: `var(--ax-viz-${tone})` }}>
      <span className="ax-avatar__initials">{initials}</span>
    </span>
  );
}

export function Basic() {
  return (
    <>
      <PageHead
        title="Basic Tables"
        subtitle="Static table variants — striped, bordered, hover, compact & responsive — built on the Aurora .ax-table primitive."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/tables/data-tables">
              {DATA_ICON}
              <span className="ax-btn__label">Data tables</span>
            </a>
            <button type="button" className="ax-btn ax-btn--primary">
              {EXPORT_ICON}
              <span className="ax-btn__label">Export CSV</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* DEFAULT TABLE */}
        <section className="ax-card ax-col--12" role="region" aria-label="Default table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Base</span>
              <h2 className="ax-card__title">Default Table</h2>
              <p className="ax-card__subtitle">Hairline rows, uppercase eyebrow header, mono numerics — the resting style every variant builds on.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--neutral"><code className="ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>.ax-table</code></span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table">
              <caption className="ax-visually-hidden">Northwind Labs team — directory with role, department and status</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Name</th>
                  <th className="ax-table__th" scope="col">Role</th>
                  <th className="ax-table__th" scope="col">Department</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Tasks</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Ava Sutton', 'Operations Lead', 'Operations', 'success', 'Online', 24],
                  ['Marcus Reyes', 'Engineering Manager', 'Engineering', 'success', 'Online', 17],
                  ['Lena Brandt', 'Product Designer', 'Design', 'warning', 'Away', 31],
                  ['Devon Okafor', 'Backend Engineer', 'Engineering', 'success', 'Online', 12],
                  ['Priya Nair', 'Data Analyst', 'Analytics', 'neutral', 'Offline', 9],
                ] as const).map(([name, role, dept, tone, status, tasks]) => (
                  <tr key={name} className="ax-table__row">
                    <td className="ax-table__td" style={strong}>{name}</td>
                    <td className="ax-table__td" style={muted}>{role}</td>
                    <td className="ax-table__td" style={muted}>{dept}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${tone} ax-badge--pill`}><span className="ax-badge__dot" />{status}</span></td>
                    <td className="ax-table__td ax-table__td--num">{tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* STRIPED + HOVER (avatars) */}
        <section className="ax-card ax-col--6" role="region" aria-label="Striped table with avatars">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Striped &amp; Hover</h2>
              <p className="ax-card__subtitle">Zebra rows for scanability, hover tint for pointer feedback.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--accent"><code className="ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>--striped --hover</code></span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--striped ax-table--hover">
              <caption className="ax-visually-hidden">Customers with segment and lifetime value</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th" scope="col">Segment</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">LTV</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['cyan', 'CR', 'Camila Rossi', 'Lisbon', 'accent', 'VIP', '$6,180'],
                  ['violet', 'OP', 'Olivia Penrose', 'Bristol', 'accent', 'VIP', '$5,980'],
                  ['amber', 'EL', 'Erik Lindqvist', 'Malmö', 'info', 'Wholesale', '$5,240'],
                  ['pink', 'NH', 'Nadia Haddad', 'Marseille', 'accent', 'VIP', '$4,720'],
                  ['emerald', 'YT', 'Yuki Tanaka', 'Osaka', 'neutral', 'Returning', '$2,870'],
                ] as const).map(([tone, initials, name, city, badge, segment, ltv]) => (
                  <tr key={name} className="ax-table__row">
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <AvatarInitials tone={tone} initials={initials} />
                        <div style={{ minWidth: 0 }}><div className="ax-text-truncate" style={strong}>{name}</div><div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{city}</div></div>
                      </div>
                    </td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${badge}`}>{segment}</span></td>
                    <td className="ax-table__td ax-table__td--num" style={numStrong}>{ltv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* BORDERED */}
        <section className="ax-card ax-col--6" role="region" aria-label="Bordered table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Bordered</h2>
              <p className="ax-card__subtitle">Full cell rules — best for dense, spreadsheet-like data.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--accent"><code className="ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>--bordered</code></span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--bordered ax-table--hover">
              <caption className="ax-visually-hidden">Aperture Goods inventory with stock and price</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">SKU</th>
                  <th className="ax-table__th" scope="col">Product</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Stock</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['APG-0008', 'Brass Task Light', '22', false, '$182.00'],
                  ['APG-0001', 'Aperture Desk Lamp', '84', false, '$129.00'],
                  ['APG-0004', 'Walnut Monitor Riser', '41', false, '$96.00'],
                  ['APG-0002', 'Linen Pinboard', '0', true, '$58.00'],
                  ['APG-0003', 'Matte Ceramic Mug', '312', false, '$24.00'],
                ] as const).map(([sku, product, stock, danger, price]) => (
                  <tr key={sku} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={mono}>{sku}</td>
                    <td className="ax-table__td" style={strong}>{product}</td>
                    <td className="ax-table__td ax-table__td--num" style={danger ? { color: 'var(--ax-danger-500)' } : undefined}>{stock}</td>
                    <td className="ax-table__td ax-table__td--num" style={numStrong}>{price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* COMPACT */}
        <section className="ax-card ax-col--6" role="region" aria-label="Compact table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Compact</h2>
              <p className="ax-card__subtitle">40px rows — pack more on screen without losing legibility.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--accent"><code className="ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>--compact</code></span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--compact ax-table--hover">
              <caption className="ax-visually-hidden">Recent ledger entries</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Ref</th>
                  <th className="ax-table__th" scope="col">Counterparty</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['TXN-88301', 'Camila Rossi', '+$312.00', 'var(--ax-viz-emerald)'],
                  ['TXN-88300', 'Cloud hosting', '−$1,200.00', 'var(--ax-text)'],
                  ['TXN-88298', 'Payroll — June', '−$18,400.00', 'var(--ax-text)'],
                  ['TXN-88297', 'Erik Lindqvist', '+$1,544.00', 'var(--ax-viz-emerald)'],
                  ['TXN-88296', 'Ad spend — Pulse', '−$640.00', 'var(--ax-text)'],
                  ['TXN-88295', 'Sofia Marchetti', '+$104.00', 'var(--ax-viz-emerald)'],
                  ['TXN-88294', 'Stripe payout', '−$9,820.00', 'var(--ax-text)'],
                ] as const).map(([ref, party, amount, color]) => (
                  <tr key={ref} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)' }}>{ref}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text)' }}>{party}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color }}>{amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CONTEXTUAL ROWS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Contextual rows table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Contextual Rows</h2>
              <p className="ax-card__subtitle">Semantic row tints to surface state at a glance.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--accent"><code className="ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>__row--success</code></span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table">
              <caption className="ax-visually-hidden">Recent orders by fulfilment state</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['success', '#10480', 'Aisha Bello', '$80.00', 'success', 'Delivered'],
                  ['', '#10482', 'Camila Rossi', '$312.00', 'accent', 'Shipped'],
                  ['warning', '#10475', 'Yuki Tanaka', '$225.00', 'warning', 'Pending'],
                  ['danger', '#10478', 'Daniel Cho', '$24.00', 'danger', 'Cancelled'],
                  ['', '#10477', 'Olivia Penrose', '$200.00', 'success', 'Delivered'],
                ] as const).map(([rowTone, order, customer, total, badge, status], i) => (
                  <tr key={order + i} className={`ax-table__row${rowTone ? ` ax-table__row--${rowTone}` : ''}`}>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{order}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text)' }}>{customer}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{total}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${badge}`}>{status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* RESPONSIVE (with totals footer) */}
        <section className="ax-card ax-col--12" role="region" aria-label="Responsive table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Behaviour</span>
              <h2 className="ax-card__title">Responsive &amp; Totals</h2>
              <p className="ax-card__subtitle">Wide tables scroll horizontally below the lg breakpoint; the footer carries the totals row.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster ax-text-muted" style={{ gap: 'var(--ax-space-1)', fontSize: 'var(--ax-text-xs)' }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M5 12l4 4" /><path d="M5 12l4 -4" /><path d="M19 12l-4 4" /><path d="M19 12l-4 -4" /></svg>
                Scroll on small screens
              </span>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 760 }}>
              <caption className="ax-visually-hidden">Order ledger with payment, fulfilment and totals</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Items</th>
                  <th className="ax-table__th" scope="col">Payment</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['#10482', 'Camila Rossi', 'Jun 12', 4, 'success', 'Paid', 'accent', 'Shipped', '$312.00'],
                  ['#10479', 'Erik Lindqvist', 'Jun 10', 9, 'success', 'Paid', 'success', 'Delivered', '$1,544.00'],
                  ['#10477', 'Olivia Penrose', 'Jun 8', 5, 'success', 'Paid', 'success', 'Delivered', '$200.00'],
                  ['#10475', 'Yuki Tanaka', 'Jun 5', 5, 'warning', 'Unpaid', 'warning', 'Pending', '$225.00'],
                  ['#10473', 'Nadia Haddad', 'Jun 1', 3, 'danger', 'Refunded', 'danger', 'Refunded', '$238.00'],
                ] as const).map(([order, customer, date, items, payTone, payment, statusTone, status, total]) => (
                  <tr key={order} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }}>{order}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>{customer}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>{date}</td>
                    <td className="ax-table__td ax-table__td--num">{items}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${payTone}`}>{payment}</span></td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${statusTone}`}>{status}</span></td>
                    <td className="ax-table__td ax-table__td--num" style={numStrong}>{total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="ax-table__foot">
                <tr>
                  <td className="ax-table__td" colSpan={3} style={{ color: 'var(--ax-text-muted)' }}>5 orders · last 12 days</td>
                  <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>26</td>
                  <td className="ax-table__td" colSpan={2} />
                  <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>$2,519.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default Basic;
