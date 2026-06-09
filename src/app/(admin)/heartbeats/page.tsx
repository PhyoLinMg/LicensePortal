import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import clsx from 'clsx'

type StalenessInfo = { label: string; textCls: string; dotCls: string; pulse: boolean }

function staleness(lastSeenAt: Date): StalenessInfo {
  const age = Date.now() - new Date(lastSeenAt).getTime()
  if (age < 60 * 60 * 1000)          return { label: 'LIVE',  textCls: 'fg-green',  dotCls: 'bg-green',  pulse: true  }
  if (age < 24 * 60 * 60 * 1000)     return { label: 'TODAY', textCls: 'fg-blue',   dotCls: 'bg-[var(--blue)]',  pulse: false }
  if (age < 7 * 24 * 60 * 60 * 1000) return { label: 'STALE', textCls: 'fg-orange', dotCls: 'bg-[var(--orange)]', pulse: false }
  return                                     { label: 'OLD',   textCls: 'fg-red',    dotCls: 'bg-red',    pulse: false }
}

function fmtTs(d: Date) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19)
}

export default async function HeartbeatsPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const products = await db.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      licenses: {
        include: {
          instances: { orderBy: { lastSeenAt: 'desc' } },
          customer: { select: { id: true, name: true } },
        },
        where: { instances: { some: {} } },
      },
    },
  })

  const totalInstances = products.reduce(
    (sum, p) => sum + p.licenses.reduce((s, l) => s + l.instances.length, 0), 0,
  )
  const liveCount = products.reduce((sum, p) =>
    sum + p.licenses.reduce((s, l) =>
      s + l.instances.filter(i => Date.now() - new Date(i.lastSeenAt).getTime() < 60 * 60 * 1000).length, 0), 0)

  return (
    <>
      <div className="px-8 pt-8">
        {/* Header */}
        <div className="pb-6 bdb">
          <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Keyforge</p>
          <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Heartbeats</h1>
        </div>

        {/* Stats */}
        <div className="flex gap-8 py-[18px] bdb">
          <Stat label="Total Instances" value={totalInstances} />
          <Stat label="Live (last 1h)" value={liveCount} colorCls="fg-green" />
          <Stat label="Products" value={products.length} />
        </div>
      </div>

      {/* Tables per product */}
      <div className="px-8 py-6 flex flex-col gap-6">
        {totalInstances === 0 ? (
          <div className="text-[11px] fg-muted tracking-[0.15em] py-6">No heartbeats received yet.</div>
        ) : (
          products.map((product) => {
            const instances = product.licenses
              .flatMap(l => l.instances.map(i => ({ ...i, license: l })))
              .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
            if (instances.length === 0) return null

            return (
              <div key={product.id} className="bd">
                {/* Product header */}
                <div className="flex items-center justify-between px-4 py-2.5 bdb bg-s1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-xs font-medium fg-t1">{product.name}</span>
                    <span className="text-[10px] fg-muted">{product.slug}</span>
                  </div>
                  <span className="text-[9px] tracking-[0.15em] fg-muted uppercase">
                    {instances.length} instance{instances.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[28px_260px_130px_80px_70px_1fr_1fr] px-4 py-1.5 text-[9px] tracking-[0.18em] fg-muted bdb uppercase">
                  <span /><span>Instance UUID</span><span>Customer</span>
                  <span>Version</span><span>Seq</span><span>Last Seen (UTC)</span><span>First Seen (UTC)</span>
                </div>

                {/* Rows */}
                {instances.map((inst) => {
                  const s = staleness(inst.lastSeenAt)
                  return (
                    <div key={inst.id} className="hb-row grid grid-cols-[28px_260px_130px_80px_70px_1fr_1fr] px-4 py-[9px] bdb items-center transition-[background] duration-100">
                      <div className="flex items-center">
                        <span className={clsx('w-1.5 h-1.5 rounded-full inline-block', s.dotCls, s.pulse && '[animation:pulse-dot_1.5s_ease-in-out_infinite]')} />
                      </div>
                      <span className="text-[10px] fg-t2 tracking-[0.02em]">{inst.instanceUuid}</span>
                      <Link href={`/licenses/${inst.license.id}`} className={`hb-link text-[11px] ${s.textCls} no-underline transition-colors duration-100`}>
                        {inst.license.customer.name}
                      </Link>
                      <span className="text-[10px] fg-muted">{inst.lastVersion ? `v${inst.lastVersion}` : '—'}</span>
                      <span className="text-[10px] fg-muted">{inst.latestSequence.toString()}</span>
                      <span className={`text-[10px] ${s.textCls}`}>{fmtTs(inst.lastSeenAt)}</span>
                      <span className="text-[10px] fg-muted">{fmtTs(inst.firstSeenAt)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function Stat({ label, value, colorCls = 'fg-t2' }: { label: string; value: number; colorCls?: string }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.2em] fg-muted uppercase mb-[3px]">{label}</div>
      <div className={`text-[22px] font-semibold ${colorCls} tracking-[-0.03em]`}>{value}</div>
    </div>
  )
}
