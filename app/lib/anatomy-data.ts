// STRUCTURE ONLY — no translatable prose lives here.
// Every organ and hotspot is identified by a stable id plus its Terminologia
// Anatomica (TA2) Latin term, which is the canonical key locale files translate
// against. Positions, colours, and model paths are locale-independent.

export type OrganId =
  | "heart"
  | "brain"
  | "lungs"
  | "liver"
  | "kidneys"
  | "eyeball"
  | "intestine"
  | "pancreas"
  | "skin";

export type HotspotStructure = {
  id: string;
  /** Terminologia Anatomica term — the canonical identity across all locales. */
  ta: string;
  position: [number, number, number];
  color: string;
};

/** Body systems, grouping organs for the Systems browser and cross-navigation. */
export type SystemId =
  | "cardiovascular"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "sensory"
  | "endocrine"
  | "integumentary";

/** A citation for the medical content shown for an organ. Names and URLs are
 *  proper nouns / addresses, so — like `model` and `scientificName` — they stay
 *  identical across locales rather than living in the translated dictionaries. */
export type Reference = {
  label: string;
  url: string;
};

export type OrganStructure = {
  id: OrganId;
  model: string;
  icon: string;
  accent: string;
  /** Whether `/anatomy/<id>/*.webp` illustrations exist. */
  illustrated: boolean;
  /** Latin binomial — intentionally identical in every locale. */
  scientificName: string;
  hotspots: HotspotStructure[];
  /** Which body system this organ belongs to, for the Systems browser. */
  systemId: SystemId;
  /** Other organs worth cross-navigating to from this one. */
  relatedOrganIds: OrganId[];
  /** Provenance for the medical content — shown in the lesson flow's Sources step. */
  references: Reference[];
};

const TA_REFERENCE: Reference = {
  label: "Terminologia Anatomica (FIPAT, 2nd ed.)",
  url: "https://ta2viewer.openanatomy.org/",
};
const MEDLINEPLUS: Reference = { label: "MedlinePlus — anatomy & conditions", url: "https://medlineplus.gov/" };
const openStax = (chapter: string): Reference => ({
  label: `OpenStax, Anatomy & Physiology 2e — ${chapter}`,
  url: "https://openstax.org/details/books/anatomy-and-physiology-2e",
});

export const organStructures: OrganStructure[] = [
  {
    id: "heart",
    model: "/models/heart.glb",
    icon: "♥",
    accent: "#ee7c6a",
    illustrated: true,
    scientificName: "Cor",
    hotspots: [
      { id: "aorta", ta: "Aorta", position: [0.12, 1.16, 0.49], color: "#ee7c6a" },
      { id: "left-atrium", ta: "Atrium sinistrum", position: [0.82, 0.65, 0.5], color: "#f2a33b" },
      { id: "right-atrium", ta: "Atrium dextrum", position: [-0.9, 0.35, 0.55], color: "#6393d8" },
      { id: "left-ventricle", ta: "Ventriculus sinister", position: [0.7, -0.75, 0.65], color: "#f2a33b" },
      { id: "right-ventricle", ta: "Ventriculus dexter", position: [-0.65, -0.68, 0.66], color: "#ee7c6a" },
      { id: "mitral", ta: "Valva atrioventricularis sinistra", position: [0.18, -1.35, 0.48], color: "#d89bc4" },
      { id: "superior-vena-cava", ta: "Vena cava superior", position: [-0.39, 1.04, 0.66], color: "#6393d8" },
      { id: "pulmonary-trunk", ta: "Truncus pulmonalis", position: [0.46, 0.94, 0.21], color: "#6393d8" },
      { id: "pulmonary-veins", ta: "Venae pulmonales", position: [0.91, 0.77, -0.48], color: "#f2a33b" },
      { id: "apex", ta: "Apex cordis", position: [0.49, -1.9, 0.11], color: "#ee7c6a" },
    ],
    systemId: "cardiovascular",
    relatedOrganIds: ["lungs", "brain"],
    references: [openStax("The Cardiovascular System: The Heart"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "brain",
    model: "/models/brain.glb",
    icon: "◉",
    accent: "#c58696",
    illustrated: true,
    scientificName: "Encephalon",
    hotspots: [
      { id: "frontal", ta: "Lobus frontalis", position: [-0.7, 0.65, 0.8], color: "#ee7c6a" },
      { id: "parietal", ta: "Lobus parietalis", position: [0.15, 1.1, 0.65], color: "#f2a33b" },
      { id: "temporal", ta: "Lobus temporalis", position: [0.75, -0.1, 0.82], color: "#6393d8" },
      { id: "cerebellum", ta: "Cerebellum", position: [0.72, -0.9, 0.55], color: "#d89bc4" },
      { id: "occipital", ta: "Lobus occipitalis", position: [1.67, 0, 0.43], color: "#7fa88a" },
      { id: "brainstem", ta: "Truncus encephali", position: [0.52, -1.44, 0.2], color: "#6393d8" },
    ],
    systemId: "nervous",
    relatedOrganIds: ["eyeball", "heart"],
    references: [openStax("The Central Nervous System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "lungs",
    model: "/models/lungs.glb",
    icon: "◍",
    accent: "#dd8f8b",
    illustrated: true,
    scientificName: "Pulmones",
    hotspots: [
      { id: "trachea", ta: "Trachea", position: [0, 0.86, 0.11], color: "#6393d8" },
      { id: "right-lung", ta: "Pulmo dexter", position: [-1.2, 0.1, 0.7], color: "#ee7c6a" },
      { id: "left-lung", ta: "Pulmo sinister", position: [1.2, 0.1, 0.7], color: "#f2a33b" },
      { id: "bronchus", ta: "Bronchus principalis", position: [-0.03, 0.3, 0.35], color: "#d89bc4" },
      { id: "base", ta: "Basis pulmonis", position: [-1.14, -1.2, 1], color: "#7fa88a" },
      { id: "larynx", ta: "Larynx", position: [-0.09, 1.73, 0.23], color: "#c58696" },
      { id: "right-upper-lobe", ta: "Lobus superior pulmonis dextri", position: [-0.86, 0.81, 0.52], color: "#ee7c6a" },
      { id: "right-middle-lobe", ta: "Lobus medius pulmonis dextri", position: [-0.58, -0.92, 1.16], color: "#f2a33b" },
      { id: "right-lower-lobe", ta: "Lobus inferior pulmonis dextri", position: [-1.27, -0.92, -0.97], color: "#6393d8" },
      { id: "left-upper-lobe", ta: "Lobus superior pulmonis sinistri", position: [0.69, 0.86, 0.52], color: "#ee7c6a" },
      { id: "left-lower-lobe", ta: "Lobus inferior pulmonis sinistri", position: [1.27, -0.92, -0.97], color: "#6393d8" },
      { id: "cardiac-notch", ta: "Incisura cardiaca pulmonis sinistri", position: [0.79, -1.03, 1.14], color: "#d89bc4" },
    ],
    systemId: "respiratory",
    relatedOrganIds: ["heart", "intestine"],
    references: [openStax("The Respiratory System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "liver",
    model: "/models/liver.glb",
    icon: "≈",
    accent: "#b86858",
    illustrated: true,
    scientificName: "Hepar",
    hotspots: [
      { id: "right-lobe", ta: "Lobus hepatis dexter", position: [-0.75, 0.35, 0.75], color: "#ee7c6a" },
      { id: "left-lobe", ta: "Lobus hepatis sinister", position: [0.85, 0.25, 0.75], color: "#f2a33b" },
      { id: "portal", ta: "Vena portae hepatis", position: [0.1, -0.3, 0.82], color: "#6393d8" },
      { id: "gallbladder", ta: "Vesica biliaris", position: [0.2, 0.55, 0.59], color: "#7fa88a" },
      { id: "inferior-vena-cava", ta: "Vena cava inferior", position: [-0.08, 1.24, -0.06], color: "#6393d8" },
      { id: "hepatic-artery", ta: "Arteria hepatica propria", position: [0.15, -0.52, 0.67], color: "#ee7c6a" },
    ],
    systemId: "digestive",
    relatedOrganIds: ["intestine", "pancreas"],
    references: [openStax("The Digestive System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "kidneys",
    model: "/models/kidneys.glb",
    icon: "∞",
    accent: "#c96963",
    illustrated: true,
    scientificName: "Renes",
    hotspots: [
      { id: "cortex", ta: "Cortex renalis", position: [-1.44, -0.12, 0.7], color: "#ee7c6a" },
      { id: "medulla", ta: "Medulla renalis", position: [0.85, 0.2, 0.7], color: "#f2a33b" },
      { id: "ureter", ta: "Ureter", position: [0.4, -1.1, 0.5], color: "#6393d8" },
      { id: "renal-artery", ta: "Arteria renalis", position: [-0.4, 0.27, 0.42], color: "#ee7c6a" },
      { id: "renal-vein", ta: "Vena renalis", position: [-0.27, 0.07, 0.07], color: "#6393d8" },
      { id: "renal-pelvis", ta: "Pelvis renalis", position: [-0.86, 0.35, 0.23], color: "#7fa88a" },
    ],
    systemId: "urinary",
    relatedOrganIds: ["liver", "intestine"],
    references: [openStax("The Urinary System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "eyeball",
    model: "/models/eyeball.glb",
    icon: "⊙",
    accent: "#7294b9",
    illustrated: true,
    scientificName: "Oculus",
    hotspots: [
      { id: "cornea", ta: "Cornea", position: [-0.94, 0.05, 1.47], color: "#6393d8" },
      { id: "iris", ta: "Iris", position: [-1.22, -0.53, 1.15], color: "#f2a33b" },
      { id: "optic", ta: "Nervus opticus", position: [1.61, -0.18, 0.54], color: "#d89bc4" },
      { id: "pupil", ta: "Pupilla", position: [-1.24, 0.06, 1.03], color: "#ee7c6a" },
      { id: "sclera", ta: "Sclera", position: [-0.06, 0.69, 1.37], color: "#7fa88a" },
      { id: "eye-muscle", ta: "Musculi externi bulbi oculi", position: [0.52, 0, 1.37], color: "#c58696" },
    ],
    systemId: "sensory",
    relatedOrganIds: ["brain"],
    references: [openStax("The Special Senses"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "intestine",
    model: "/models/intestine.glb",
    icon: "§",
    accent: "#d78b77",
    illustrated: true,
    scientificName: "Intestinum",
    hotspots: [
      { id: "duodenum", ta: "Duodenum", position: [0.6, 0.8, 0.75], color: "#f2a33b" },
      { id: "jejunum", ta: "Jejunum", position: [-0.45, 0.1, 0.82], color: "#ee7c6a" },
      { id: "colon", ta: "Colon", position: [0.75, -0.55, 0.72], color: "#6393d8" },
      { id: "ileum", ta: "Ileum", position: [-0.72, -0.32, 0.26], color: "#f2a33b" },
      { id: "cecum", ta: "Caecum", position: [-1.21, -0.12, 0.48], color: "#7fa88a" },
      { id: "appendix", ta: "Appendix vermiformis", position: [-0.99, -0.58, 0.26], color: "#d89bc4" },
      { id: "ascending-colon", ta: "Colon ascendens", position: [-1.55, 0.4, 0.01], color: "#6393d8" },
      { id: "transverse-colon", ta: "Colon transversum", position: [0, 1.32, 0.68], color: "#ee7c6a" },
      { id: "descending-colon", ta: "Colon descendens", position: [1.38, 0, 0.26], color: "#f2a33b" },
      { id: "rectum", ta: "Rectum", position: [0, -1.38, 0.29], color: "#c58696" },
    ],
    systemId: "digestive",
    relatedOrganIds: ["liver", "pancreas"],
    references: [openStax("The Digestive System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "pancreas",
    model: "/models/pancreas.glb",
    icon: "◈",
    accent: "#c69a5e",
    illustrated: true,
    scientificName: "Pancreas",
    hotspots: [
      { id: "head", ta: "Caput pancreatis", position: [-1.32, -0.36, 0.55], color: "#ee7c6a" },
      { id: "body", ta: "Corpus pancreatis", position: [0.05, 0.25, 0.45], color: "#f2a33b" },
      { id: "tail", ta: "Cauda pancreatis", position: [1.55, 0.3, 0.35], color: "#6393d8" },
      { id: "duct", ta: "Ductus pancreaticus", position: [-0.61, 0.39, 0.5], color: "#d89bc4" },
      { id: "uncinate-process", ta: "Processus uncinatus pancreatis", position: [-0.75, -0.72, 0.53], color: "#7fa88a" },
    ],
    systemId: "endocrine",
    relatedOrganIds: ["liver", "intestine"],
    references: [openStax("The Endocrine System"), TA_REFERENCE, MEDLINEPLUS],
  },
  {
    id: "skin",
    model: "/models/skin.glb",
    icon: "▦",
    accent: "#c99277",
    illustrated: true,
    scientificName: "Integumentum",
    hotspots: [
      { id: "epidermis", ta: "Epidermis", position: [-0.05, 0.88, 1.4], color: "#ee7c6a" },
      { id: "dermis", ta: "Dermis", position: [0.29, 0.05, 1.4], color: "#f2a33b" },
      { id: "hypodermis", ta: "Tela subcutanea", position: [-0.39, -1.15, 1.4], color: "#6393d8" },
      { id: "follicle", ta: "Folliculus pili", position: [0.89, -0.44, 1.4], color: "#d89bc4" },
      { id: "hair-shaft", ta: "Scapus pili", position: [1, 0.98, 1.15], color: "#c58696" },
      { id: "hair-bulb", ta: "Bulbus pili", position: [-0.55, -0.58, 1.49], color: "#ee7c6a" },
      { id: "sebaceous-gland", ta: "Glandula sebacea", position: [-0.17, -0.03, 1.51], color: "#f2a33b" },
      { id: "sweat-gland", ta: "Glandula sudorifera", position: [-1.06, -0.37, 1.55], color: "#7fa88a" },
      { id: "arrector-pili", ta: "Musculus arrector pili", position: [1.43, 0.1, 1.35], color: "#6393d8" },
      { id: "blood-vessels", ta: "Vasa sanguinea", position: [0.46, -1.01, 1.35], color: "#ee7c6a" },
    ],
    systemId: "integumentary",
    relatedOrganIds: ["kidneys"],
    references: [openStax("The Integumentary System"), TA_REFERENCE, MEDLINEPLUS],
  },
];

export const organIds = organStructures.map((organ) => organ.id);
export const structureById = Object.fromEntries(
  organStructures.map((organ) => [organ.id, organ]),
) as Record<OrganId, OrganStructure>;

/** Stable, locale-independent system ordering for the Systems browser. */
export const systemIds: SystemId[] = [
  "cardiovascular",
  "nervous",
  "respiratory",
  "digestive",
  "urinary",
  "sensory",
  "endocrine",
  "integumentary",
];

export const organIdsBySystem: Record<SystemId, OrganId[]> = Object.fromEntries(
  systemIds.map((systemId) => [
    systemId,
    organStructures.filter((organ) => organ.systemId === systemId).map((organ) => organ.id),
  ]),
) as Record<SystemId, OrganId[]>;

/**
 * Real-world size for "see it in your room". Every GLB is normalised into the
 * same viewer cube, so the files carry no scale of their own; AR scales the
 * model so its longest side matches `sizeCm`.
 *
 * `enlarged` marks models that can't sensibly be shown at life size — a 2.4 cm
 * eye is too small to find on a table, and the skin model is a magnified
 * cross-section block — so the AR view labels them as enlarged, not life size.
 */
export type ArSize = { sizeCm: number; enlarged: boolean };

export const arSizes: Record<OrganId, ArSize> = {
  heart: { sizeCm: 12, enlarged: false },       // apex to base
  brain: { sizeCm: 16.5, enlarged: false },     // front to back
  lungs: { sizeCm: 26, enlarged: false },       // pair, apex to base
  liver: { sizeCm: 21, enlarged: false },       // side to side
  kidneys: { sizeCm: 20, enlarged: false },     // the pair with the great vessels between
  eyeball: { sizeCm: 12, enlarged: true },      // really ~2.4 cm
  intestine: { sizeCm: 28, enlarged: false },   // the coiled mass as it sits in the abdomen
  pancreas: { sizeCm: 15, enlarged: false },    // head to tail
  skin: { sizeCm: 20, enlarged: true },         // a magnified section of skin
};
