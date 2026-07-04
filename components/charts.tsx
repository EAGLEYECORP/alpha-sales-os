"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Single-hue bronze system: magnitude = lightness, identity = axis labels.
export const BRONZE = "#b08d57";
export const BRONZE_LIGHT = "#d9bc8c";
export const BRONZE_DARK = "#8f6f42";
const GRID = "#292420";
const TEXT = "#7d766c";

const tooltipStyle = {
  contentStyle: {
    background: "#171412",
    border: "1px solid #3a332d",
    borderRadius: 8,
    fontSize: 12,
    color: "#e8e2d9",
  },
  labelStyle: { color: "#d9bc8c", fontWeight: 600 },
  itemStyle: { color: "#e8e2d9" },
  cursor: { fill: "rgba(176,141,87,0.08)" },
};

export function FunnelChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={88}
          tick={{ fill: TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} prospect(s)`, ""]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} label={{ position: "right", fill: "#e8e2d9", fontSize: 11 }}>
          {data.map((_, i) => (
            <Cell key={i} fill={BRONZE} fillOpacity={1 - i * 0.09} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ForecastChart({
  data,
}: {
  data: { name: string; signe: number; pondere: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="gradSigne" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRONZE_LIGHT} stopOpacity={0.5} />
            <stop offset="100%" stopColor={BRONZE_LIGHT} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradPond" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRONZE_DARK} stopOpacity={0.4} />
            <stop offset="100%" stopColor={BRONZE_DARK} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k€`}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, name: string) => [
            `${Math.round(v).toLocaleString("fr-FR")} €`,
            name === "signe" ? "MRR signé" : "MRR pondéré (pipe)",
          ]}
        />
        <Area type="monotone" dataKey="pondere" stroke={BRONZE_DARK} strokeWidth={2} fill="url(#gradPond)" name="pondere" />
        <Area type="monotone" dataKey="signe" stroke={BRONZE_LIGHT} strokeWidth={2} fill="url(#gradSigne)" name="signe" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SectorChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v: number) => `${Math.round(v / 100) / 10}k€`}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Math.round(v).toLocaleString("fr-FR")} €`, "Pipe pondéré"]} />
        <Bar dataKey="value" fill={BRONZE} radius={[4, 4, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
