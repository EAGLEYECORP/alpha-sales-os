"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Single-hue gold system (Closer OS DA): magnitude = lightness, identity = axis labels.
export const BRONZE = "#E8C98A";
export const BRONZE_LIGHT = "#F2E2BC";
export const BRONZE_DARK = "#B98F4B";
const GRID = "#2B241C";
const TEXT = "#8E877B";

const tooltipStyle = {
  contentStyle: {
    background: "#15110D",
    border: "1px solid #3A3227",
    borderRadius: 12,
    fontSize: 12,
    color: "#F3EEE4",
  },
  labelStyle: { color: "#E8C98A", fontWeight: 600 },
  itemStyle: { color: "#F3EEE4" },
  cursor: { fill: "rgba(232,201,138,0.08)" },
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

/** Two-series grouped bars: openness vs responsiveness per campaign (%). */
export function CampaignRatesChart({
  data,
}: {
  data: { name: string; ouverture: number; reponse: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v} %`, name === "ouverture" ? "Taux d'ouverture" : "Taux de réponse"]} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: TEXT }}
          formatter={(v: string) => (v === "ouverture" ? "Ouverture" : "Réponse")}
        />
        <Bar dataKey="ouverture" fill={BRONZE_LIGHT} radius={[4, 4, 0, 0]} barSize={18} label={{ position: "top", fill: TEXT, fontSize: 10, formatter: (v: number) => `${v}%` }} />
        <Bar dataKey="reponse" fill={BRONZE_DARK} radius={[4, 4, 0, 0]} barSize={18} label={{ position: "top", fill: TEXT, fontSize: 10, formatter: (v: number) => `${v}%` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Barres par catégorie. `variant` :
 *  - "eur"   (défaut) : axe/tooltip en euros (pipe pondéré par secteur)
 *  - "score" : axe/tooltip sur une échelle 0–100 (confiance par étape)
 */
export function SectorChart({
  data,
  variant = "eur",
  tooltipLabel,
}: {
  data: { name: string; value: number }[];
  variant?: "eur" | "score";
  tooltipLabel?: string;
}) {
  const isScore = variant === "score";
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: TEXT, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={isScore ? 30 : 52}
          domain={isScore ? [0, 100] : undefined}
          tickFormatter={(v: number) => (isScore ? `${Math.round(v)}` : `${Math.round(v / 100) / 10}k€`)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) =>
            isScore
              ? [`${Math.round(v)}/100`, tooltipLabel ?? "Score"]
              : [`${Math.round(v).toLocaleString("fr-FR")} €`, tooltipLabel ?? "Pipe pondéré"]
          }
        />
        <Bar dataKey="value" fill={BRONZE} radius={[4, 4, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
