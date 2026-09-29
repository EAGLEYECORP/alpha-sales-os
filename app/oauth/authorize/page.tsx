import { ConsentementOAuth } from "@/components/oauth/consentement";

export const dynamic = "force-dynamic";

export const metadata = { title: "Autoriser un agent — Alpha Sales OS", robots: { index: false } };

/**
 * `/oauth/authorize` — l'écran où l'on autorise Claude (ou Cowork) à se brancher
 * sur Alpha. La décision se prend côté serveur (`/api/oauth/authorize`) ;
 * cette page ne fait que montrer la demande et transmettre ton choix.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const requete = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") requete.set(k, v);
  return <ConsentementOAuth requete={requete.toString()} />;
}
