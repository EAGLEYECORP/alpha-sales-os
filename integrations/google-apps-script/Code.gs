/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA SALES OS® — CRM « mémoire » (Google Sheets + Apps Script)
 * EAGLEYE CORP — Lyon
 *
 * Ce script transforme un Google Sheets en CRM :
 *   1. Il crée / maintient la feuille « CRM » avec le schéma exact
 *      (colonnes issues de la liste de prospection régies Lyon).
 *   2. Il GÉNÈRE les scripts de vente en fonction du STATUT (étape) du
 *      client dans le pipeline — email / DM / appel, remplis avec les
 *      bonnes variables de la ligne (note Google, taxe, ville, contact…).
 *   3. Il expose un Web App (doGet/doPost) pour que le backend n8n lise
 *      et REMPLISSE le CRM à chaque étape, avec le maximum d'infos.
 *
 * Déploiement : voir README.md de ce dossier.
 * ─────────────────────────────────────────────────────────────────────
 */

/* ======================================================================
 * 0. CONFIG
 * ==================================================================== */

// Secret partagé exigé sur le Web App (query ?token= ou champ token du POST).
// Définis-le dans Projet → Paramètres du projet → Propriétés du script :
//   clé = API_TOKEN, valeur = un secret long et aléatoire.
function getApiToken_() {
  return PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
}

// Nom de l'agence / du closer — injecté dans les scripts générés.
function getCloserName_() {
  return PropertiesService.getScriptProperties().getProperty('CLOSER_NAME') || 'EAGLEYE';
}

var SHEET_NAME = 'CRM';

/* ======================================================================
 * 1. SCHÉMA — la « mémoire ». L'ordre EST l'ordre des colonnes.
 *    `key` = nom de variable stable (utilisé par le Web App + n8n).
 *    Ne réordonne pas sans migrer la feuille : les writers utilisent la clé.
 * ==================================================================== */

var COLUMNS = [
  { key: 'prospect',      label: 'Prospect' },              // A — raison sociale
  { key: 'type',          label: "Type d'entreprise" },     // B
  { key: 'rating',        label: "Note d'avis" },           // C — note Google
  { key: 'reviews',       label: "Nombre d'avis" },         // D
  { key: 'experience',    label: "Années d'expérience" },   // E
  { key: 'city',          label: 'Ville / Emplacement' },   // F
  { key: 'phone',         label: 'Téléphone' },             // G
  { key: 'email',         label: 'Email' },                 // H
  { key: 'hours',         label: 'Horaires' },              // I
  { key: 'website',       label: 'Site' },                  // J
  { key: 'onSite',        label: 'Service sur place' },     // K
  { key: 'onlineBooking', label: 'Rdv en ligne' },          // L
  { key: 'stage',         label: 'Étape' },                 // M — statut pipeline
  { key: 'audit',         label: 'Audit' },                 // N — synthèse audit
  { key: 'contact',       label: 'Contact' },               // O — décideur
  { key: 'history',       label: 'History' },               // P — journal horodaté
  { key: 'message',       label: 'Message' },               // Q — dernier message / brouillon
  { key: 'meeting',       label: 'Meeting' },               // R — prochain RDV
  { key: 'obstacles',     label: 'Obstacles' },             // S — pré-offre
  { key: 'objections',    label: 'Objections' },            // T — post-offre (Red Zone)
  { key: 'tax',           label: "Taxe d'ignorance (€/mois)" }, // U
  { key: 'closeDate',     label: 'Close date' },            // V
  { key: 'deadline',      label: 'Deadline (next step)' },  // W — next step daté
  { key: 'delivery',      label: 'Delivery status' },       // X
  { key: 'satisfaction',  label: 'Satisfaction' },          // Y
  { key: 'upsell',        label: 'Upsell' },                // Z
  { key: 'notes',         label: 'Notes' },                 // AA
  { key: 'updatedAt',     label: 'Maj le' },                // AB — horodatage auto
  // ── Colonnes ajoutées APRÈS updatedAt = migration non destructive :
  //    « ① Initialiser / réparer » les ajoute en fin sans décaler l'existant.
  { key: 'channel',       label: "Plateforme d'échange" },  // AC — canal privilégié
  { key: 'testimonial',   label: 'Témoignage' },            // AD — preuve sociale
  { key: 'delivered',     label: 'Délivré' },               // AE — tracking (alpha-tracking-sync)
  { key: 'opens',         label: 'Ouvertures' },            // AF
  { key: 'clicks',        label: 'Clics' },                 // AG
  { key: 'lastSentAt',    label: 'Dernier envoi' },         // AH
  { key: 'campaignId',    label: 'Campagne' },              // AI
  { key: 'unsubscribed',  label: 'STOP / Désinscrit' }      // AJ — flag STOP (n8n → send-guard)
];

// Étapes du pipeline (statuts) — miroir de l'app ALPHA SALES OS.
var STAGES = ['prospect', 'contact', 'audit', 'demo', 'offre', 'redzone', 'signe', 'perdu'];

var STAGE_LABELS = {
  prospect: 'Prospect', contact: 'Contact', audit: 'Audit', demo: 'Démo',
  offre: 'Offre', redzone: 'Red Zone', signe: 'Signé', perdu: 'Perdu'
};

// Délai par défaut (jours) pour le next step daté selon l'étape.
var STAGE_DEADLINE_DAYS = {
  prospect: 2, contact: 2, audit: 3, demo: 2, offre: 2, redzone: 1, signe: 3, perdu: 90
};

/* ======================================================================
 * 2. MENU — outillage humain dans la feuille
 * ==================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🦅 ALPHA SALES OS')
    .addItem('① Initialiser / réparer le CRM', 'setupSheet')
    .addItem('② Charger les régies Lyon (démo)', 'seedLyon')
    .addSeparator()
    .addItem('✍️  Générer le script de la ligne sélectionnée', 'generateScriptForSelection')
    .addItem('➡️  Avancer l\'étape (+ next step daté)', 'advanceStageForSelection')
    .addItem('🕓  Ajouter au History (note horodatée)', 'appendHistoryPrompt')
    .addSeparator()
    .addItem('🔑 Afficher l\'URL du Web App', 'showWebAppUrl')
    .addToUi();
}

/* ======================================================================
 * 3. SETUP & SEED
 * ==================================================================== */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  return sh;
}

function setupSheet() {
  var sh = getSheet_();
  var headers = COLUMNS.map(function (c) { return c.label; });

  // Ligne d'en-tête
  var headerRange = sh.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold').setBackground('#1c1917').setFontColor('#e7c46b');
  sh.setFrozenRows(1);

  // Validation sur la colonne Étape
  var stageCol = colIndex_('stage') + 1;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(STAGES, true).setAllowInvalid(false).build();
  sh.getRange(2, stageCol, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);

  // Largeurs lisibles
  sh.autoResizeColumns(1, headers.length);
  SpreadsheetApp.getActive().toast('CRM initialisé (' + headers.length + ' colonnes).', 'ALPHA', 4);
}

/**
 * Charge les régies immobilières de Lyon (source : liste de prospection).
 * N'écrase jamais une ligne existante (matching par nom).
 */
function seedLyon() {
  setupSheet();
  var existing = {};
  readAll_().forEach(function (r) { existing[normName_(r.prospect)] = true; });

  var added = 0;
  SEED_REGIES.forEach(function (r) {
    if (existing[normName_(r.prospect)]) return;
    var obj = {
      prospect: r.prospect, type: r.type || 'Agence immobilière',
      rating: r.rating || '', reviews: r.reviews || '', experience: r.experience || '',
      city: 'Lyon', phone: r.phone || '', website: r.website || '',
      onSite: r.onSite || '', onlineBooking: r.onlineBooking || '',
      stage: 'prospect'
    };
    appendRow_(obj);
    added++;
  });
  SpreadsheetApp.getActive().toast(added + ' régies ajoutées.', 'ALPHA', 4);
}

/* ======================================================================
 * 4. LECTURE / ÉCRITURE — mapping colonnes ↔ objets (les bonnes variables)
 * ==================================================================== */

function colIndex_(key) {
  for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i].key === key) return i;
  return -1;
}

function normName_(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function rowToObj_(row, rowNumber) {
  var o = { _row: rowNumber };
  for (var i = 0; i < COLUMNS.length; i++) o[COLUMNS[i].key] = row[i] === undefined ? '' : row[i];
  return o;
}

function objToRow_(obj) {
  return COLUMNS.map(function (c) { return obj[c.key] === undefined ? '' : obj[c.key]; });
}

function readAll_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  return values.map(function (row, i) { return rowToObj_(row, i + 2); });
}

function findRowByKey_(idOrEmail) {
  var target = normName_(idOrEmail);
  var all = readAll_();
  for (var i = 0; i < all.length; i++) {
    if (normName_(all[i].prospect) === target) return all[i];
    if (all[i].email && normName_(all[i].email) === target) return all[i];
  }
  return null;
}

function appendRow_(obj) {
  var sh = getSheet_();
  obj.updatedAt = new Date();
  sh.appendRow(objToRow_(obj));
  return sh.getLastRow();
}

/**
 * Upsert : crée ou met à jour par nom (prospect) ou email. Ne remplace
 * QUE les champs fournis — n8n peut enrichir progressivement (max d'infos).
 */
function upsert_(obj) {
  var key = obj.prospect || obj.email;
  if (!key) throw new Error('upsert: prospect ou email requis');
  var existing = findRowByKey_(key);
  if (!existing) {
    if (!obj.stage) obj.stage = 'prospect';
    var rowNum = appendRow_(obj);
    return rowToObj_(getSheet_().getRange(rowNum, 1, 1, COLUMNS.length).getValues()[0], rowNum);
  }
  // merge : champ fourni & non vide écrase
  var merged = {};
  COLUMNS.forEach(function (c) { merged[c.key] = existing[c.key]; });
  Object.keys(obj).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    if (obj[k] !== '' && obj[k] !== null && obj[k] !== undefined) merged[k] = obj[k];
  });
  merged.updatedAt = new Date();
  var sh = getSheet_();
  sh.getRange(existing._row, 1, 1, COLUMNS.length).setValues([objToRow_(merged)]);
  return rowToObj_(sh.getRange(existing._row, 1, 1, COLUMNS.length).getValues()[0], existing._row);
}

/** Ajoute une entrée horodatée au History (journal, jamais écrasé). */
function appendHistory_(idOrEmail, text) {
  var row = findRowByKey_(idOrEmail);
  if (!row) throw new Error('appendHistory: introuvable — ' + idOrEmail);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var line = '[' + stamp + '] ' + text;
  var prev = row.history ? String(row.history) + '\n' : '';
  var sh = getSheet_();
  sh.getRange(row._row, colIndex_('history') + 1).setValue(prev + line);
  sh.getRange(row._row, colIndex_('updatedAt') + 1).setValue(new Date());
  return line;
}

/** Change l'étape et pose automatiquement un next step daté (Deadline). */
function setStage_(idOrEmail, stage, action) {
  if (STAGES.indexOf(stage) === -1) throw new Error('étape invalide: ' + stage);
  var row = findRowByKey_(idOrEmail);
  if (!row) throw new Error('setStage: introuvable — ' + idOrEmail);
  var sh = getSheet_();
  sh.getRange(row._row, colIndex_('stage') + 1).setValue(stage);
  var days = STAGE_DEADLINE_DAYS[stage] || 2;
  var due = new Date(); due.setDate(due.getDate() + days);
  sh.getRange(row._row, colIndex_('deadline') + 1)
    .setValue(Utilities.formatDate(due, Session.getScriptTimeZone(), 'yyyy-MM-dd') + (action ? ' — ' + action : ''));
  if (stage === 'signe') sh.getRange(row._row, colIndex_('closeDate') + 1).setValue(new Date());
  sh.getRange(row._row, colIndex_('updatedAt') + 1).setValue(new Date());
  appendHistory_(idOrEmail, 'Étape → ' + (STAGE_LABELS[stage] || stage) + (action ? ' (' + action + ')' : ''));
  return true;
}

/* ======================================================================
 * 5. GÉNÉRATION DE SCRIPTS vis-à-vis du STATUT (le cœur de la demande)
 *    Chaque étape a un objectif ; on remplit avec les bonnes variables.
 * ==================================================================== */

function money_(n) {
  var v = Number(String(n).replace(/[^\d.-]/g, ''));
  if (!v) return '';
  return v.toLocaleString ? v.toLocaleString('fr-FR') + ' €' : v + ' €';
}

/** Variables disponibles pour un prospect (les « bonnes variables »). */
function scriptVars_(o) {
  var contact = String(o.contact || '').split(/[\s,;(]/)[0] || 'bonjour';
  var taxMonth = money_(o.tax);
  var taxWeek = o.tax ? money_(Math.round(Number(String(o.tax).replace(/[^\d.-]/g, '')) / 4.33)) : '';
  return {
    contact: contact,
    commerce: o.prospect || 'votre agence',
    ville: (String(o.city || 'Lyon').split('—')[0] || 'Lyon').trim(),
    note: o.rating ? String(o.rating) : '',
    avis: o.reviews ? String(o.reviews).replace(/^-/, '') : '',
    taxe: taxMonth,
    taxe_semaine: taxWeek,
    closer: getCloserName_(),
    site: o.website || '',
    audit: o.audit || ''
  };
}

/**
 * Retourne { email:{subject,body}, dm:string, appel:string } pour l'étape
 * courante du prospect. Angle : régies immobilières (avis Google + réactivité).
 */
function generateScripts_(o) {
  var v = scriptVars_(o);
  var stage = STAGES.indexOf(o.stage) === -1 ? 'prospect' : o.stage;

  // Preuve d'avis : une note faible = argument #1 pour une régie.
  var reviewPain = v.note
    ? 'votre fiche Google est à ' + v.note + '/5' + (v.avis ? ' (' + v.avis + ' avis)' : '') +
      ' — chaque locataire ou propriétaire compare AVANT d\'appeler'
    : 'la plupart des mandats se décident après un passage par Google et votre site';

  var lib = {
    prospect: {
      email: {
        subject: v.commerce + ' — 20 min pour chiffrer ce qui vous échappe',
        body: 'Bonjour ' + v.contact + ',\n\n' +
          'Je travaille avec des régies de ' + v.ville + ' sur un point précis : ' + reviewPain + '.\n\n' +
          'Je ne vends rien par email. Je vous propose 20 minutes sur place : je mesure ce que ça vous coûte réellement chaque mois (mandats perdus, appels ratés), vous gardez les chiffres, vous décidez avec.\n\n' +
          'Mardi 15h ou jeudi 10h ?\n\n' + v.closer + ' — EAGLEYE, Lyon'
      },
      dm: 'Bonjour ' + v.contact + ' 👋 ' + v.closer + ' (EAGLEYE, Lyon). Question directe : ' + reviewPain + '. J\'ai 2 chiffres à vous montrer sur ' + v.commerce + ', 2 minutes, pas un pitch. Je passe mardi 15h ou jeudi 10h ?',
      appel: '1. « Bonjour, ' + v.contact + ' ? ' + v.closer + ', je travaille avec des régies de ' + v.ville + '. 30 secondes. »\n' +
        '2. DOULEUR : « ' + reviewPain + '. »\n' +
        '3. BASCULE : « Je ne vends rien au téléphone — 20 min sur place, je chiffre vos pertes, vous décidez. Mardi 15h ou jeudi 10h ? »'
    },
    contact: {
      email: {
        subject: 'Suite à notre échange — le créneau d\'audit',
        body: 'Bonjour ' + v.contact + ',\n\nComme convenu, je bloque 20 minutes pour ' + v.commerce + '. Je viens avec un diagnostic chiffré : visibilité, avis, mandats/appels qui passent à la trappe.\n\nMardi 15h ou jeudi 10h — lequel vous arrange ?\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', on cale les 20 min d\'audit pour ' + v.commerce + ' ? Mardi 15h ou jeudi 10h. Vous repartez avec les chiffres quoi qu\'il arrive.',
      appel: 'Confirmer le créneau. Rappeler le bénéfice : « Vous gardez le diagnostic même si on ne travaille jamais ensemble. » Objectif unique : une date.'
    },
    audit: {
      email: {
        subject: 'Notre RDV — ce que je vais mesurer chez ' + v.commerce,
        body: 'Bonjour ' + v.contact + ',\n\nConfirmé. En 20 minutes je chiffre trois choses :\n1. Combien de propriétaires/locataires vous cherchent en ligne… et vont chez le concurrent\n2. Combien d\'appels et de demandes passent à la trappe chaque semaine\n3. Ce que ça représente en euros par mois\n\nVous gardez le document. À bientôt !\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', on se voit bientôt 👋 J\'apporte le diagnostic complet de ' + v.commerce + ' — vous gardez les chiffres même si on ne travaille pas ensemble.',
      appel: 'RESTITUTION : « Chaque mois, ' + v.commerce + ' laisse filer ' + (v.taxe || 'X €') + ' — des mandats/appels qui vont au concurrent qui répond. » Puis SILENCE. Puis : « On regarde à quoi ressemblerait la solution, 2 min sur mon téléphone ? »'
    },
    demo: {
      email: {
        subject: v.commerce + ' — j\'ai quelque chose à vous montrer',
        body: 'Bonjour ' + v.contact + ',\n\nSuite à l\'audit, j\'ai préparé une maquette vivante de ' + v.commerce + ' : votre nom, vos couleurs, votre réalité. Ça se regarde en 2 minutes sur un téléphone.\n\nJe passe cette semaine — plutôt début ou fin d\'après-midi ?\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', la maquette de ' + v.commerce + ' est prête 👀 Je ne l\'envoie pas — ça se voit en vrai, 2 min. Je suis dans le quartier cette semaine, quel jour ?',
      appel: 'PENDANT LA DÉMO : tendre le téléphone, se taire 10 s. « Voilà ' + v.commerce + ' quand on le cherche en ligne. » Ne JAMAIS parler prix pendant la démo.'
    },
    offre: {
      email: {
        subject: v.commerce + ' — où en êtes-vous ?',
        body: 'Bonjour ' + v.contact + ',\n\nVous avez vu la maquette et les chiffres : ' + (v.taxe || 'ce qui part chaque mois') + ' pendant que rien ne change.\n\nJe ne remets pas l\'offre par écrit — on l\'a vue ensemble. Il reste un appel de 10 minutes pour décider, dans un sens ou dans l\'autre.\n\nDemain 11h ou 16h ?\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', depuis notre échange ' + v.commerce + ' a encore laissé filer ~' + (v.taxe_semaine || 'quelques mandats') + ' 📉 On fait l\'appel décision de 10 min ? Demain 11h ou 16h.',
      appel: 'CLOSING : « De 1 à 10, à combien vous croyez que ça marcherait POUR VOUS ? » Sous 10 → « Qu\'est-ce qui manque pour un 10 ? » Réparer la vraie croyance, pas argumenter le prix.'
    },
    redzone: {
      email: {
        subject: 'On tranche — ' + v.commerce,
        body: 'Bonjour ' + v.contact + ',\n\nDernière ligne droite. On a tout vu ; il reste à lever le dernier point. Dites-moi ce qui vous retient VRAIMENT, en une phrase — je vous réponds franchement, et on décide.\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', qu\'est-ce qui vous retient vraiment ? Une phrase. On lève ça et on décide — ' + v.commerce + ' perd ' + (v.taxe_semaine || 'chaque semaine') + ' à attendre.',
      appel: 'ISOLER l\'objection → identifier la croyance cassée (produit marche / tu me soutiens / ça marche POUR MOI) → réparer CELLE-LÀ. Puis verrouiller une date de démarrage.'
    },
    signe: {
      email: {
        subject: 'C\'est parti, ' + v.contact + ' 🦅',
        body: 'Bienvenue chez EAGLEYE !\n\nVoilà le rail :\n· J+3 : prévisualisation\n· J+7 : mise en ligne + prise en main (15 min)\n· J+30 : premier rapport chiffré\n\nVous n\'avez qu\'à valider. Mon numéro direct répond.\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', le projet de ' + v.commerce + ' avance 🚀 Dans votre réseau de gestionnaires, qui perd des mandats comme vous en perdiez ? Deux noms = un mois offert par signature.',
      appel: 'J+30 : donner les résultats chiffrés d\'abord. « Qu\'est-ce qui vous a le plus surpris ? » → avis Google → 2 recommandations.'
    },
    perdu: {
      email: {
        subject: '3 idées gratuites pour ' + v.commerce,
        body: 'Bonjour ' + v.contact + ',\n\nPromis, je ne revends rien. Trois choses que les meilleures régies de ' + v.ville + ' font en ce moment :\n1. Répondre à chaque avis Google (même les bons)\n2. Mettre les horaires à jour partout\n3. Publier une photo de bien par semaine\n\nSi un jour vous voulez la version complète, vous savez où me trouver.\n\n' + v.closer + ' — EAGLEYE'
      },
      dm: v.contact + ', des nouvelles fraîches d\'une régie voisine qui a récupéré des mandats en ligne. Je repense à ' + v.commerce + ' — quand vous voulez, on refait le point, sans engagement.',
      appel: 'J+90 : « Il y a 3 mois vous m\'aviez dit non — peut-être la bonne décision alors. Où en êtes-vous ? » Réécouter, reproposer l\'audit gratuit.'
    }
  };

  return { stage: stage, stageLabel: STAGE_LABELS[stage], scripts: lib[stage] };
}

/* ======================================================================
 * 6. ACTIONS MENU
 * ==================================================================== */

function selectedRowObj_() {
  var sh = getSheet_();
  var r = sh.getActiveRange().getRow();
  if (r < 2) throw new Error('Sélectionne une ligne de prospect (pas l\'en-tête).');
  return rowToObj_(sh.getRange(r, 1, 1, COLUMNS.length).getValues()[0], r);
}

function generateScriptForSelection() {
  var o = selectedRowObj_();
  var res = generateScripts_(o);
  var s = res.scripts;
  var msg = '▸ Étape : ' + res.stageLabel + '\n\n' +
    '✉ EMAIL — ' + s.email.subject + '\n' + s.email.body + '\n\n' +
    '💬 DM :\n' + s.dm + '\n\n' + '📞 APPEL :\n' + s.appel;
  // Écrit le brouillon dans la colonne Message + affiche
  getSheet_().getRange(o._row, colIndex_('message') + 1).setValue('Objet: ' + s.email.subject + '\n' + s.email.body);
  var ui = SpreadsheetApp.getUi();
  ui.alert('Script — ' + o.prospect + ' (' + res.stageLabel + ')', msg, ui.ButtonSet.OK);
}

function advanceStageForSelection() {
  var o = selectedRowObj_();
  var idx = STAGES.indexOf(o.stage);
  var next = STAGES[Math.min(idx + 1, STAGES.indexOf('signe'))];
  if (idx === -1) next = 'contact';
  setStage_(o.prospect, next, 'avancé depuis la feuille');
  SpreadsheetApp.getActive().toast(o.prospect + ' → ' + STAGE_LABELS[next], 'ALPHA', 4);
}

function appendHistoryPrompt() {
  var o = selectedRowObj_();
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('History — ' + o.prospect, 'Note à horodater :', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() === ui.Button.OK && res.getResponseText()) {
    appendHistory_(o.prospect, res.getResponseText());
    SpreadsheetApp.getActive().toast('Ajouté au History.', 'ALPHA', 3);
  }
}

function showWebAppUrl() {
  var url = ScriptApp.getService().getUrl();
  var ui = SpreadsheetApp.getUi();
  ui.alert('Web App', url ? url + '\n\nUtilise cette URL dans n8n (avec ?token=…).' :
    'Déploie d\'abord : Déployer → Nouveau déploiement → Application Web.', ui.ButtonSet.OK);
}

/* ======================================================================
 * 7. WEB APP — connectivité n8n (lecture + remplissage du CRM)
 * ==================================================================== */

function json_(obj, code) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(e) {
  var token = getApiToken_();
  if (!token) return true; // pas de secret configuré → ouvert (déconseillé en prod)
  var provided = (e && e.parameter && e.parameter.token) ||
    (e && e.postData && safeJson_(e.postData.contents).token) || '';
  return provided === token;
}

function safeJson_(s) { try { return JSON.parse(s); } catch (err) { return {}; } }

/**
 * GET — lecture & scripts.
 *   ?action=list                → toutes les lignes
 *   ?action=get&id=NOM|email    → une ligne
 *   ?action=script&id=NOM       → scripts pour l'étape courante
 *   ?action=schema              → schéma (colonnes + étapes)
 *   ?action=due                 → lignes dont la Deadline est passée
 */
function doGet(e) {
  if (!checkToken_(e)) return json_({ ok: false, error: 'token invalide' });
  var action = (e.parameter.action || 'list');
  try {
    if (action === 'schema')
      return json_({ ok: true, columns: COLUMNS, stages: STAGES, stageLabels: STAGE_LABELS });
    if (action === 'list')
      return json_({ ok: true, rows: readAll_().map(stripRow_) });
    if (action === 'get') {
      var row = findRowByKey_(e.parameter.id);
      return json_({ ok: !!row, row: row ? stripRow_(row) : null });
    }
    if (action === 'script') {
      var r2 = findRowByKey_(e.parameter.id);
      if (!r2) return json_({ ok: false, error: 'introuvable' });
      return json_({ ok: true, prospect: r2.prospect, result: generateScripts_(r2) });
    }
    if (action === 'due') {
      var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      var due = readAll_().filter(function (r) {
        var d = String(r.deadline || '').slice(0, 10);
        return d && d <= today && r.stage !== 'signe' && r.stage !== 'perdu';
      });
      return json_({ ok: true, rows: due.map(stripRow_) });
    }
    return json_({ ok: false, error: 'action inconnue: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * POST — écriture (n8n remplit la mémoire à chaque étape).
 * Body JSON : { token, action, ... }
 *   action=upsert          { data:{prospect,email,rating,...} }
 *   action=history         { id, text }
 *   action=stage           { id, stage, next? }   // next = texte du next step
 *   action=set             { id, field, value }   // maj d'un champ précis
 *   action=script          { id }                 // idem GET script
 */
function doPost(e) {
  if (!checkToken_(e)) return json_({ ok: false, error: 'token invalide' });
  var body = safeJson_(e.postData ? e.postData.contents : '{}');
  var action = body.action || 'upsert';
  try {
    if (action === 'upsert') {
      var saved = upsert_(body.data || {});
      return json_({ ok: true, row: stripRow_(saved) });
    }
    if (action === 'history') {
      var line = appendHistory_(body.id, String(body.text || ''));
      return json_({ ok: true, line: line });
    }
    if (action === 'stage') {
      // `next` = texte du next step. Rétro-compat : accepte l'ancien `nextAction`.
      setStage_(body.id, body.stage, body.next || body.nextAction || '');
      return json_({ ok: true });
    }
    if (action === 'set') {
      var row = findRowByKey_(body.id);
      if (!row) return json_({ ok: false, error: 'introuvable' });
      var ci = colIndex_(body.field);
      if (ci === -1) return json_({ ok: false, error: 'champ inconnu: ' + body.field });
      var sh = getSheet_();
      sh.getRange(row._row, ci + 1).setValue(body.value);
      sh.getRange(row._row, colIndex_('updatedAt') + 1).setValue(new Date());
      return json_({ ok: true });
    }
    if (action === 'script') {
      var r3 = findRowByKey_(body.id);
      if (!r3) return json_({ ok: false, error: 'introuvable' });
      return json_({ ok: true, result: generateScripts_(r3) });
    }
    return json_({ ok: false, error: 'action inconnue: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Retire le numéro de ligne interne, sérialise les dates.
function stripRow_(o) {
  var out = {};
  Object.keys(o).forEach(function (k) {
    if (k === '_row') return;
    var v = o[k];
    out[k] = (v instanceof Date) ? v.toISOString() : v;
  });
  return out;
}

/* ======================================================================
 * 8. SEED DATA — régies immobilières Lyon (source de prospection)
 * ==================================================================== */

var SEED_REGIES = [
  { prospect: 'Régie de la Part Dieu', rating: '3,1', reviews: '64', experience: 'Plus de 30 ans', phone: '04 78 62 77 04', website: 'http://www.regiedelapartdieu.com/', onSite: 'Oui' },
  { prospect: 'Lyon Régie', rating: '3,4', reviews: '37', experience: 'Plus de 10 ans', phone: '04 72 12 20 58', website: 'http://www.lyonregie.com/', onSite: 'Oui' },
  { prospect: 'Régie MOUTON', rating: '2,9', reviews: '230', experience: 'Plus de 165 ans', phone: '04 78 95 98 98', website: 'http://www.mouton.fr/', onlineBooking: 'Oui' },
  { prospect: 'REGIE DERVAULT BY Géraldine Andrieux', rating: '4,1', reviews: '213', experience: 'Plus de 7 ans', phone: '04 78 02 04 78', website: 'https://www.regie-dervault-andrieux.fr/', onSite: 'Oui' },
  { prospect: 'Régie Pariset', rating: '4,4', reviews: '85', experience: 'Plus de 10 ans', phone: '04 72 12 23 24', website: 'http://www.regie-pariset.com/', onSite: 'Oui' },
  { prospect: "Oralia Régie de l'Opéra", type: 'Société de gestion immobilière', rating: '3,8', reviews: '596', experience: 'Plus de 10 ans', phone: '04 72 98 19 19', website: 'https://www.oralia.fr/', onSite: 'Oui' },
  { prospect: 'RÉGIE FRANÇOIS GOFFIN', type: 'Société de gestion immobilière', rating: '4,4', reviews: '136', experience: 'Plus de 10 ans', phone: '04 72 40 50 80', website: 'http://www.regiegoffin.fr/', onSite: 'Oui' },
  { prospect: 'Regie Conseil - Gestion Immobilière & Locative Lyon', rating: '1,9', reviews: '34', experience: 'Plus de 30 ans', phone: '04 72 71 67 67', website: 'https://www.regie-conseil.fr/', onSite: 'Oui' },
  { prospect: 'Regie Pedrini', rating: '1,5', reviews: '16', phone: '', website: '', onSite: 'Oui' },
  { prospect: 'Régie Générale de Lyon', rating: '4', reviews: '147', experience: 'Plus de 30 ans', phone: '04 37 24 20 10', website: 'https://regiegeneraledelyon.com/', onSite: 'Oui' },
  { prospect: 'Régie MOUTON - Agence Sala', type: 'Agence de location immobilière', rating: '3,8', reviews: '115', experience: 'Plus de 7 ans', phone: '04 78 95 98 99', website: 'http://www.mouton.fr/', onSite: 'Oui' },
  { prospect: 'Regie Carron', type: 'Société de gestion immobilière', rating: '4,1', reviews: '145', experience: 'Plus de 10 ans', phone: '04 78 37 69 17', website: 'http://www.regie-carron.com/', onSite: 'Oui' },
  { prospect: 'Human Immobilier Lyon - Gestion Locative', type: 'Agence de location immobilière', rating: '4,5', reviews: '115', experience: 'Plus de 3 ans', phone: '04 37 56 11 22', website: 'https://www.human-immobilier.fr/', onlineBooking: 'Oui' },
  { prospect: 'Régie Saint-Pierre', rating: '4,3', reviews: '60', experience: 'Plus de 10 ans', phone: '04 72 44 51 64', website: 'http://www.regiesaintpierre.fr/', onlineBooking: 'Oui' },
  { prospect: 'Lyon 3 Immobilier', rating: '4,3', reviews: '9', experience: 'Plus de 25 ans', phone: '04 78 54 65 00', website: 'http://www.lyon3immo.com/', onlineBooking: 'Oui' },
  { prospect: 'Immo de France Lyon Centre Siège social', rating: '3,3', reviews: '271', experience: 'Plus de 10 ans', phone: '04 72 75 40 00', website: 'http://www.immodefrance-rhone.fr/', onlineBooking: 'Oui' },
  { prospect: 'REGIE BGC VILLEURBANNE', rating: '3,1', reviews: '117', experience: 'Plus de 10 ans', phone: '04 72 68 88 10', website: 'http://regie-bgc.fr/', onlineBooking: 'Oui' },
  { prospect: 'Essentiel - Agence Immobilière à Lyon', rating: '4,8', reviews: '250', experience: 'Plus de 10 ans', phone: '04 37 57 32 78', website: 'http://www.essentiel-gestionlocative.fr/', onlineBooking: 'Oui' },
  { prospect: 'Régie Simonneau - Lyon 6', rating: '3,6', reviews: '404', experience: 'Plus de 25 ans', phone: '04 78 24 24 24', website: 'https://www.regie-simonneau.com/', onlineBooking: 'Oui' },
  { prospect: 'Régie GINDRE', type: 'Société de gestion immobilière', rating: '3,5', reviews: '283', experience: 'Plus de 120 ans', phone: '04 72 10 66 90', website: 'https://www.regiegindre.com/' },
  { prospect: 'Régie Bellecour', rating: '4,1', reviews: '204', experience: 'Plus de 10 ans', phone: '04 78 59 15 95', website: 'http://www.regiebellecour.fr/' },
  { prospect: 'FONCIA Lyon Garibaldi', rating: '3,2', reviews: '872', experience: 'Plus de 5 ans', phone: '04 72 84 52 12', website: 'https://fr.foncia.com/' },
  { prospect: 'B.I.C. IMMOBILIER', rating: '4,9', reviews: '205', experience: 'Plus de 30 ans', phone: '04 78 60 06 06', website: 'http://www.bic-immo.com/' },
  { prospect: 'Régie C.I.F.I', rating: '4,3', reviews: '108', experience: 'Plus de 10 ans', phone: '04 78 93 44 24', website: 'http://www.regiecifi.com/' },
  { prospect: 'Régie Franchet & Cie', rating: '3,7', reviews: '181', experience: 'Plus de 125 ans', phone: '04 78 38 73 73', website: 'http://www.regiefranchet.fr/' },
  { prospect: 'Orpi Part Dieu Immobilier Conseil Lyon 3eme', rating: '4,5', reviews: '244', experience: 'Plus de 15 ans', phone: '04 72 84 75 10', website: 'https://www.orpi.com/agence-part-dieu/' },
  { prospect: 'Century 21 Part-Dieu', rating: '4,3', reviews: '65', experience: 'Plus de 10 ans', phone: '04 78 14 50 77', website: 'http://www.century21-part-dieu-lyon-3.com/' },
  { prospect: 'FONCIA Lyon Av. Marechal de Saxe', rating: '2,9', reviews: '1100', experience: 'Plus de 3 ans', phone: '04 37 48 20 00', website: 'https://fr.foncia.com/' },
  { prospect: 'La Regie Du Lyonnais', rating: '2,9', reviews: '67', experience: 'Plus de 20 ans', phone: '04 72 43 06 06', website: 'http://www.laregiedulyonnais.fr/' },
  { prospect: 'César et Brutus - Agence immobilière Lyon', rating: '4,7', reviews: '2000', experience: 'Plus de 10 ans', phone: '04 82 53 99 88', website: 'http://www.cesaretbrutus.com/' },
  { prospect: 'Régie Appia Immobilier', rating: '4,8', reviews: '63', experience: 'Plus de 5 ans', phone: '04 78 79 10 31', website: 'http://www.appia-immo.com/' },
  { prospect: 'NOVEA Immobilier Lyon 6', rating: '4,9', reviews: '371', experience: 'Plus de 10 ans', phone: '04 37 72 95 36', website: 'http://www.novea-immobilier.fr/' },
  { prospect: 'ERA Immobilier Lyon 3 Lacassagne', rating: '4,7', reviews: '31', experience: 'Plus de 5 ans', phone: '04 37 91 19 65', website: 'http://www.era-lacassagne.com/' }
];
