/* Réglages des comptes en ligne (service Supabase).
   Tant que supabaseUrl et supabaseKey sont vides, les comptes restent enregistrés dans le navigateur du visiteur. */
window.SOUS30 = {
  supabaseUrl: 'https://cyezicjuhpulktyivyme.supabase.co',
  supabaseKey: 'sb_publishable_xyUoof01wzlBHvqIWWFCbg_6ECYHRS_',   // clé « publishable » : publique par nature. Jamais la clé secrète.
  tipUrl: 'https://ko-fi.com/sous30',   // page de dons. Vide : pas de bouton « Tip me ».
  providers: ['discord', 'google'],   // réseaux activés pour la connexion, par exemple ['discord', 'google']
};
