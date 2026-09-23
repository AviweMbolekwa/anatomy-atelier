import type { BaseUiDictionary } from "../types";

export const ui: BaseUiDictionary = {
  meta: {
    title: "Anatomy Atelier — Explore ton corps de l’intérieur",
    description: "Explore le cœur, le cerveau, les poumons et bien plus en 3D, réponds à une nouvelle question chaque jour et vois les organes en taille réelle chez toi. L’anatomie pour les enfants curieux, en 12 langues.",
    ogTitle: "Anatomy Atelier — Explore ton corps de l’intérieur",
    ogDescription: "Des organes en 3D, une question par jour et la réalité augmentée en taille réelle : l’anatomie pour les enfants curieux.",
    imageAlt: "Un cœur anatomique flottant au-dessus d'un socle, à côté du logotype Anatomy Atelier",
  },
  brand: { tagline: "Explore ton corps de l’intérieur", home: "Accueil d'Anatomy Atelier" },
  nav: { explore: "Explorer", systems: "Systèmes", lessons: "Leçons", library: "Bibliothèque", notes: "Notes" },
  search: { placeholder: "Rechercher un organe, un thème…" },
  profile: { open: "Ouvrir le profil de l'apprenant" },
  language: { label: "Langue", choose: "Choisir une langue" },
  library: {
    title: "Bibliothèque d'organes", open: "Ouvrir la bibliothèque d'organes", close: "Fermer la bibliothèque",
    saved: "Organes enregistrés", viewAll: "Voir tous les organes",
    quoteLine1: "Apprendre est", quoteLine2: "un acte de curiosité.", quoteSign: "Continuez à explorer !",
  },
  tools: {
    label: "Outils de la visionneuse 3D", rotate: "Pivoter", zoom: "Zoom", isolate: "Isoler",
    section: "Coupe transversale", layers: "Couches", compare: "Comparer", reset: "Réinitialiser",
  },
  viewer: {
    title: "Visionneuse interactive : {organ}",
    canvas: "Modèle anatomique 3D interactif. Faites glisser pour pivoter, défilez pour zoomer et cliquez sur un point pour lire la description de la structure.",
    tip: "Astuce", tipDrag: "Faites glisser pour pivoter", tipScroll: "Défilez pour zoomer",
    tipClick: "Cliquez sur un point pour en savoir plus",
    loading: "Préparation : {organ}", autoRotate: "Rotation automatique",
    caption: "Spécimen 3D · cliquez sur un point", structures: "Structures de ce spécimen",
  },
  info: {
    kicker: "{organ}", keyFacts: "Repères", size: "Taille", weight: "Poids", daily: "Chaque jour",
    location: "Situation", bloodSupply: "Vascularisation", function: "Fonction",
    medical: "Importance médicale", didYouKnow: "Le saviez-vous", viewLesson: "Voir la leçon",
    animate: "Animer", quiz: "Quiz", compare: "Comparer",
  },
  compare: {
    title: "Comparaison d'organes", comparing: "Comparaison", reference: "Référence",
    primaryRole: "Rôle principal", scale: "Échelle", vs: "vs", close: "Fermer la comparaison",
  },
  cards: {
    resources: "Ressources d'apprentissage : {organ}",
    microscopic: "Vue microscopique", compareOrgans: "Comparer les organes", functionAnimation: "Animation fonctionnelle",
    clinicalNotes: "Notes cliniques", whereItWorks: "Où il agit", commonConditions: "Affections fréquentes",
    exploreTissue: "Explorer le tissu", openComparison: "Ouvrir la comparaison", playAnimation: "Lancer l'animation",
    seeAll: "Tout voir", seeSystem: "Voir le système",
    playAria: "Lancer l'animation fonctionnelle : {organ}", systemAria: "Voir où se situe {organ} dans le corps",
  },
  quiz: {
    start: "Commencer le quiz d'identification", find: "Trouvez", progress: "{current} sur {total}",
    correct: "Correct", wrong: "Pas tout à fait", reveal: "C'est : {label}", answer: "{label} est indiqué en vert",
    done: "Quiz terminé", score: "{score} bonnes réponses sur {total}", retry: "Réessayer",
    exit: "Quitter le quiz", hint: "Cliquez sur le point correspondant du modèle",
  },
  modal: {
    guided: "Découverte guidée", close: "Fermer", continueExploring: "Continuer l'exploration",
    quizTitle: "Quiz express : {organ}", motionTitle: "{organ} en mouvement",
    bodyTitle: "{organ} dans le corps", insideTitle: "À l'intérieur : {organ}",
    quizPrompt: "Quelle affirmation décrit le mieux cet organe ({organ}) ?",
    quizA: "Il joue un rôle spécialisé dans le maintien du corps",
    quizB: "Il fonctionne de façon totalement indépendante",
    quizC: "Il n'est actif que pendant le sommeil",
    lessonBody:
      "Suivez les structures mises en évidence, faites pivoter le spécimen et reliez la forme à la fonction. Ce court moment d'étude vise à bâtir un modèle mental durable.",
    systemIntro: "{location}. Suivez la manière dont {organ} se relie au reste du corps.",
    system: "Système", primaryRole: "Rôle principal", bloodSupply: "Vascularisation",
  },
};
