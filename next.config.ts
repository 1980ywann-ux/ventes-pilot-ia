import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Fichiers de ventes jusqu'à 20 Mo (PRD H9), plus l'enveloppe du formulaire.
    serverActions: { bodySizeLimit: "21mb" },
    // Le proxy garde le corps en mémoire : même plafond, sinon il serait tronqué.
    proxyClientMaxBodySize: "21mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
