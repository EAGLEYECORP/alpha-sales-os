# Les collecteurs extérieurs — ce qu'on branche, ce qu'on refuse

> Écrit le 17/09/2026, après lecture de deux dépôts proposés par Zakaria.
> La règle qui décide vit dans `CLAUDE.md` (« La troisième colonne : ce
> qu'Alpha NE FAIT PAS ») ; ce fichier applique cette règle à des cas précis,
> avec la mesure de chacun.

## La règle, rappelée en une phrase

**La collecte reste dehors.** Elle est remplaçable, elle porte un risque
juridique et opérationnel, et elle est « sous la responsabilité de celui qui la
fait ». Ce qui entre dans le produit, c'est la porte d'import — jamais le
collecteur. Deux gardes l'appliquent :
`tests/permis-lyon-script.test.ts` et `tests/maps-vers-alpha.test.ts`, qui
refusent qu'un fichier de `lib/`, `components/` ou `app/` importe un script de
collecte.

---

## 1. `Mahanaicoach/google-maps-scraper-kit` — **branché, comme un pont**

MIT, enveloppe de `gosom/google-maps-scraper` (Georgios Komninos, MIT).

**Ce qu'il est, mesuré en lisant son code** : un `docker-compose.yml` qui lance
le scraper sur `127.0.0.1:8080`, plus un script de pilotage en **Python
standard, sans aucune dépendance pip**. Sa sortie par défaut est un CSV de huit
colonnes : `title, phone, emails, website, category, address, review_rating,
review_count`.

### ⚠⚠ Ce qu'il ne fait PAS, et il faut le savoir avant de le lancer

**Il ne source pas notre ICP.** Notre cible depuis le 09/09 est le maître
d'ouvrage dont le **permis est actif** — un déclencheur daté. Une SCCV de
programme n'a pas de fiche Google Maps, et « promoteurs à Lyon » rend une liste
par **secteur** : elle dit QUI, jamais OÙ EN EST l'affaire. C'est exactement le
ciblage que `docs/PERMIS-LYON.md` a écarté, et pour lequel l'arrêté de permis a
été choisi.

### Ce qu'il fait, et qui manquait vraiment

**La troisième colonne.** `CLAUDE.md` l'écrit noir sur blanc : « Un export de
permis ne porte **aucun** numéro ; le téléphone se relève **à la main** ».
C'est ce relevé que `scripts/maps-vers-alpha.mjs --enrichir` automatise, en
rapprochant le nom du demandeur d'un relevé Maps.

### Les trois règles qui tiennent le pont

1. **Un `website` vide ne devient jamais « aucun ».** Une fiche Maps sans site
   veut dire « rien n'est renseigné sur Google », pas « cette entreprise n'a pas
   de site ». C'est le défaut réparé le même jour dans `lib/offer-match.ts`
   (8 fiches ICP sur 8 routées vers la Visibilité sur une chaîne vide) — et
   l'écrire ici le réintroduirait **par la donnée**, cette fois avec l'air d'une
   mesure.
2. **Le secteur se déclare (`--secteur`), il ne se devine pas** sur la
   catégorie Google. Le rapprochement par ressemblance de mots a déjà servi le
   script du moniteur d'auto-école à des directeurs de programmes.
3. **Le rapprochement est EXACT ou n'a pas lieu.** Deux établissements du même
   nom sont écartés, pas arbitrés : choisir le premier serait tirer au sort un
   numéro qui part ensuite dans une file d'appels. Et un relevé humain déjà
   présent ne se fait jamais écraser par un scraper.

### Ce qui n'a pas été testé, et ne pouvait pas l'être

**Le scraper n'a jamais tourné.** Il exige Docker et une IP qui frappe Google
Maps ; ni l'un ni l'autre n'existe dans la sandbox. Ce qui est éprouvé, c'est la
**transformation**, de l'export jusqu'à la fiche et jusqu'à l'offre proposée.

### Ce que ça engage — à lire avant de lancer un gros lot

Son propre README le dit : scraper Maps est **contraire aux CGU de Google**,
l'IP peut être temporairement bloquée sur de gros volumes, et les données de
contact relèvent du RGPD. Et une liste ainsi constituée est **mêlée** (pros et
consommateurs) : le décret n° 2022-1313 s'applique, donc le plafond de
4 sollicitations sur 30 jours glissants — celui que `lib/call-cadence.ts` tient
déjà.

---

## 2. `ScrapeGraphAI/Scrapegraph-ai` — **pas branché, et voici pourquoi**

MIT, bibliothèque Python d'extraction de pages pilotée par un LLM.

**Mesuré dans son `pyproject.toml` : 23 dépendances**, dont toute la pile
LangChain (`langchain`, `langchain-openai`, `langchain-community`,
`langchain-aws`, `langchain-mistralai`, `langchain-ollama`), `playwright`,
`undetected-playwright`, `beautifulsoup4`, `tiktoken`. Plus une clé de modèle
pour fonctionner.

Trois raisons, chacune suffisante :

- **Il n'apporte rien sur notre ICP.** Il extrait du structuré depuis une page
  qu'on lui désigne. Nos arrêtés viennent d'un export open data déjà structuré
  (`scripts/permis-lyon.mjs`), pas d'une page à interpréter.
- **Il coûte des jetons par page.** La doctrine du deep-dive est explicite :
  « payer du LLM sur 900 fiches qui ne décrocheront jamais est une fuite
  d'argent ». Ce serait la même fuite, un cran plus tôt.
- **`undetected-playwright` est un contournement de détection.** Ce n'est pas
  une brique qu'on met dans un produit vendu à des PME françaises, sur une
  vitrine dont l'argument central est la souveraineté et la conformité.

**Ce qui le rendrait utile un jour** : une source qui n'existe qu'en page web,
sans export, et qu'on aurait le droit de lire. Elle n'existe pas aujourd'hui.
Le noter ici évite qu'une session future le rebranche « parce que c'était dans
les liens ».

---

## Les autres dépôts vus le même jour

Ils ne se branchent pas, parce qu'ils ne sont pas des collecteurs — ce sont des
**outils de travail** pour Zakaria. Aucun ne vend quoi que ce soit, et aucun
n'a sa place dans `package.json` (« Pas de dépendance nouvelle »).

| Dépôt | Ce que c'est | Statut |
|---|---|---|
| `abi/screenshot-to-code` | capture d'écran → HTML/Tailwind/React | outil, hors produit |
| `mendableai/open-lovable` | générateur d'app par prompt | outil, hors produit |
| `cherry-studio`, `LocalAI`, `sub2api` | clients / passerelles de modèles | outils, hors produit |

> ⚠ Ils peuvent servir à **fabriquer** des choses pour Alpha (une maquette, une
> page). Ce qui est produit avec passe alors par les mêmes gardes que le reste :
> aucune donnée réelle, aucune preuve sociale inventée, aucune affiliation.
