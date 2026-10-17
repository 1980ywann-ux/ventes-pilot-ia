import { redirect } from "next/navigation";

// Le proxy renvoie déjà les visiteurs non connectés vers /connexion, et les
// retours de lien d'e-mail (« /?code=… ») vers /auth/confirmer.
export default function Accueil() {
  redirect("/entreprises");
}
