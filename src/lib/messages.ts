// Messages affichés après une action. L'URL ne porte qu'un code : aucun
// texte libre venant de l'URL n'est jamais affiché.
const MESSAGES = {
  identifiants: "Adresse e-mail ou mot de passe incorrect.",
  email_non_confirme: "Confirmez d'abord votre adresse e-mail grâce au lien reçu.",
  inscription: "L'inscription a échoué. Vérifiez l'adresse et choisissez un mot de passe d'au moins 10 caractères, avec majuscules, minuscules et chiffres.",
  verifier_email: "Compte créé. Ouvrez le lien reçu par e-mail pour confirmer votre adresse.",
  lien: "Ce lien n'est plus valide. Reconnectez-vous ou demandez un nouveau lien.",
  nom_invalide: "Le nom doit faire entre 1 et 120 caractères.",
  creation: "L'entreprise n'a pas pu être créée.",
  source_invalide: "Vérifiez le nom (1 à 80 caractères), le type, la base HT/TTC et la priorité (1 à 1000).",
  source_doublon: "Une source porte déjà ce nom.",
  email_invalide: "Adresse e-mail invalide.",
  invitation_doublon: "Cette adresse a déjà été invitée.",
  dernier_admin: "L'entreprise doit garder au moins un administrateur.",
  refuse: "Action non autorisée.",
  erreur: "Une erreur est survenue. Réessayez.",
  fichier_vide: "Le fichier est vide.",
  fichier_trop_gros: "Le fichier dépasse 20 Mo. Découpez-le par période (par exemple un fichier par mois).",
  format_refuse: "Format non pris en charge. Déposez un fichier .csv ou .xlsx.",
  format_xls: "L'ancien format Excel (.xls) n'est pas pris en charge. Dans Excel : Fichier > Enregistrer sous > Classeur Excel (.xlsx).",
  macros_refusees: "Les classeurs contenant des macros sont refusés par sécurité. Enregistrez une copie au format .xlsx sans macros.",
  archive_suspecte: "Ce classeur a une structure anormale et a été refusé par sécurité.",
  excel_illisible: "Ce fichier Excel est illisible ou endommagé.",
  texte_illisible: "Ce fichier ne ressemble pas à un fichier texte CSV.",
  aucune_donnee: "Aucune ligne de données trouvée (il faut une ligne d'en-têtes puis au moins une ligne).",
  trop_de_lignes: "Le fichier dépasse 200 000 lignes. Découpez-le par période.",
  feuille_inconnue: "Cette feuille n'existe pas dans le classeur.",
  source_requise: "Choisissez la source du fichier.",
  deja_importe: "Ce fichier a déjà été importé : voici l'import existant. Aucune ligne ne sera comptée deux fois.",
  depot_echoue: "Le fichier n'a pas pu être enregistré. Réessayez.",
  source_utilisee: "Cette source est utilisée par des imports : supprimez d'abord ces imports.",
  parametres_valides: "Paramètres de lecture enregistrés. Prochaine étape : associer les colonnes (étape 3 du plan).",
  import_supprime: "Import supprimé.",
  invitation_envoyee: "Invitation enregistrée. La personne rejoindra l'entreprise à sa prochaine connexion, avec cette adresse confirmée.",
} as const;

export type CodeMessage = keyof typeof MESSAGES;

export function message(code: string | string[] | undefined): string | null {
  if (typeof code !== "string") return null;
  return code in MESSAGES ? MESSAGES[code as CodeMessage] : null;
}
