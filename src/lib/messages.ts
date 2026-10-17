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
  invitation_envoyee: "Invitation enregistrée. La personne rejoindra l'entreprise à sa prochaine connexion, avec cette adresse confirmée.",
} as const;

export type CodeMessage = keyof typeof MESSAGES;

export function message(code: string | string[] | undefined): string | null {
  if (typeof code !== "string") return null;
  return code in MESSAGES ? MESSAGES[code as CodeMessage] : null;
}
