import Link from "next/link";
import { Eagle } from "@/components/eagle";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center p-4">
      <div className="card max-w-md p-7 text-center">
        <span className="mx-auto block text-bronze-400">
          <Eagle size={56} glow />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-paper">Page introuvable</h1>
        <p className="mt-2 text-sm text-paper-dim">Cette page n&apos;existe pas (ou plus). Le pipeline, lui, t&apos;attend.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="btn-bronze">Dashboard</Link>
          <Link href="/pipeline" className="btn-ghost">Pipeline</Link>
        </div>
      </div>
    </div>
  );
}
