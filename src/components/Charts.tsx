import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const axis = { stroke: 'var(--chart-grid)', tick: { fill: 'var(--chart-text)', fontSize: 12 }, tickLine: false } as const

export interface Point {
  label: string
  value: number
}

function TooltipBox({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow dark:border-slate-700 dark:bg-slate-900">
      <div className="text-slate-600 dark:text-slate-400">{p.label}</div>
      <div className="font-bold text-slate-950 dark:text-slate-50">
        {p.value.toLocaleString()} {unit}
      </div>
    </div>
  )
}

function DataTable({ data, unit }: { data: Point[]; unit: string }) {
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-slate-600 dark:text-slate-400">Show as table</summary>
      <table className="mt-1 w-full">
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-1">{d.label}</td>
              <td className="tabular py-1 text-right">
                {d.value.toLocaleString()} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export function ChartCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {sub && <p className="text-sm text-slate-600 dark:text-slate-400">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function WeeklyBars({ data, unit }: { data: Point[]; unit: string }) {
  return (
    <>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} {...axis} axisLine={false} />
            <Tooltip cursor={{ fill: 'var(--chart-accent-wash)' }} content={<TooltipBox unit={unit} />} />
            <Bar dataKey="value" fill="var(--chart-accent)" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} unit={unit} />
    </>
  )
}

export function TrendLine({ data, unit, step }: { data: Point[]; unit: string; step?: boolean }) {
  if (data.length === 0) return <p className="text-slate-600 dark:text-slate-400">No entries yet.</p>
  return (
    <>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
            <YAxis {...axis} axisLine={false} domain={['auto', 'auto']} allowDecimals={false} />
            <Tooltip cursor={{ stroke: 'var(--chart-grid)', strokeWidth: 1 }} content={<TooltipBox unit={unit} />} />
            <Line
              type={step ? 'stepAfter' : 'monotone'}
              dataKey="value"
              stroke="var(--chart-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: 'var(--chart-accent)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'var(--chart-accent)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} unit={unit} />
    </>
  )
}
