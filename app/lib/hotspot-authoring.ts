import type { OrganId } from "./anatomy-data";

export type AuthoringCandidate = {
  id: string;
  ta: string;
  label: string;
  detail: string;
  color: string;
};

/**
 * Content targets for the V2 anatomy expansion. These are deliberately kept
 * separate from anatomy-data.ts because a 3D position must be sampled from
 * the actual GLB in `?authoring=1` rather than guessed from a text description.
 *
 * Existing hotspots + these candidates = 15 structures per organ.
 */
export const hotspotCandidates: Record<OrganId, AuthoringCandidate[]> = {
  heart: [
    { id: "pulmonary-trunk", ta: "Truncus pulmonalis", label: "Pulmonary Trunk", detail: "Carries blood from the right ventricle to the lungs", color: "#6393d8" },
    { id: "pulmonary-valve", ta: "Valva trunci pulmonalis", label: "Pulmonary Valve", detail: "Prevents backflow into the right ventricle", color: "#d89bc4" },
    { id: "tricuspid", ta: "Valva atrioventricularis dextra", label: "Tricuspid Valve", detail: "Controls flow from right atrium to right ventricle", color: "#ee7c6a" },
    { id: "superior-vena-cava", ta: "Vena cava superior", label: "Superior Vena Cava", detail: "Returns blood from the upper body to the right atrium", color: "#6393d8" },
    { id: "inferior-vena-cava", ta: "Vena cava inferior", label: "Inferior Vena Cava", detail: "Returns blood from the lower body to the right atrium", color: "#6393d8" },
    { id: "pulmonary-veins", ta: "Venae pulmonales", label: "Pulmonary Veins", detail: "Return oxygenated blood from the lungs to the left atrium", color: "#f2a33b" },
    { id: "interventricular-septum", ta: "Septum interventriculare", label: "Interventricular Septum", detail: "Muscular wall separating the two ventricles", color: "#d89bc4" },
    { id: "coronary-sulcus", ta: "Sulcus coronarius", label: "Coronary Sulcus", detail: "Groove marking the boundary between atria and ventricles", color: "#7fa88a" },
    { id: "apex", ta: "Apex cordis", label: "Apex", detail: "Pointed inferior tip of the heart", color: "#ee7c6a" },
  ],
  brain: [
    { id: "occipital", ta: "Lobus occipitalis", label: "Occipital Lobe", detail: "Processes much of the visual information", color: "#7fa88a" },
    { id: "insula", ta: "Insula", label: "Insula", detail: "Cortical region involved in sensory and internal-state processing", color: "#d89bc4" },
    { id: "corpus-callosum", ta: "Corpus callosum", label: "Corpus Callosum", detail: "Large fibre tract connecting the cerebral hemispheres", color: "#f2a33b" },
    { id: "thalamus", ta: "Thalamus", label: "Thalamus", detail: "Major relay for sensory and motor signals", color: "#6393d8" },
    { id: "hypothalamus", ta: "Hypothalamus", label: "Hypothalamus", detail: "Helps regulate homeostasis and endocrine activity", color: "#ee7c6a" },
    { id: "hippocampus", ta: "Hippocampus", label: "Hippocampus", detail: "Important for memory formation and spatial processing", color: "#7fa88a" },
    { id: "brainstem", ta: "Truncus encephali", label: "Brainstem", detail: "Connects the cerebrum with the spinal cord", color: "#6393d8" },
    { id: "pons", ta: "Pons", label: "Pons", detail: "Part of the brainstem linking major neural pathways", color: "#d89bc4" },
    { id: "medulla", ta: "Medulla oblongata", label: "Medulla Oblongata", detail: "Brainstem region containing vital autonomic centres", color: "#ee7c6a" },
    { id: "pituitary", ta: "Hypophysis", label: "Pituitary Gland", detail: "Endocrine gland connected to the hypothalamus", color: "#f2a33b" },
    { id: "amygdala", ta: "Corpus amygdaloideum", label: "Amygdala", detail: "Limbic structure involved in emotional processing", color: "#c58696" },
  ],
  lungs: [
    { id: "right-upper-lobe", ta: "Lobus superior pulmonis dextri", label: "Right Upper Lobe", detail: "Superior lobe of the right lung", color: "#ee7c6a" },
    { id: "right-middle-lobe", ta: "Lobus medius pulmonis dextri", label: "Right Middle Lobe", detail: "Middle lobe unique to the right lung", color: "#f2a33b" },
    { id: "right-lower-lobe", ta: "Lobus inferior pulmonis dextri", label: "Right Lower Lobe", detail: "Inferior lobe of the right lung", color: "#6393d8" },
    { id: "left-upper-lobe", ta: "Lobus superior pulmonis sinistri", label: "Left Upper Lobe", detail: "Superior lobe of the left lung", color: "#ee7c6a" },
    { id: "left-lower-lobe", ta: "Lobus inferior pulmonis sinistri", label: "Left Lower Lobe", detail: "Inferior lobe of the left lung", color: "#f2a33b" },
    { id: "hilum", ta: "Hilum pulmonis", label: "Lung Hilum", detail: "Medial gateway for bronchi, vessels and nerves", color: "#d89bc4" },
    { id: "pleura", ta: "Pleura", label: "Pleura", detail: "Serous membrane surrounding each lung", color: "#7fa88a" },
    { id: "pulmonary-artery", ta: "Arteria pulmonalis", label: "Pulmonary Artery", detail: "Carries deoxygenated blood toward the lungs", color: "#6393d8" },
    { id: "pulmonary-veins", ta: "Venae pulmonales", label: "Pulmonary Veins", detail: "Return oxygenated blood to the left atrium", color: "#ee7c6a" },
    { id: "diaphragm", ta: "Diaphragma", label: "Diaphragm", detail: "Main muscle forming the floor of the thoracic cavity", color: "#f2a33b" },
  ],
  liver: [
    { id: "caudate-lobe", ta: "Lobus caudatus", label: "Caudate Lobe", detail: "Posterior liver lobe adjacent to the vena cava", color: "#d89bc4" },
    { id: "quadrate-lobe", ta: "Lobus quadratus", label: "Quadrate Lobe", detail: "Liver region between the gallbladder and ligamentum teres", color: "#f2a33b" },
    { id: "gallbladder", ta: "Vesica biliaris", label: "Gallbladder", detail: "Stores and concentrates bile", color: "#7fa88a" },
    { id: "hepatic-artery", ta: "Arteria hepatica propria", label: "Hepatic Artery", detail: "Supplies oxygenated blood to the liver", color: "#ee7c6a" },
    { id: "hepatic-vein", ta: "Venae hepaticae", label: "Hepatic Veins", detail: "Drain blood from the liver to the vena cava", color: "#6393d8" },
    { id: "inferior-vena-cava", ta: "Vena cava inferior", label: "Inferior Vena Cava", detail: "Receives blood leaving the hepatic veins", color: "#6393d8" },
    { id: "common-hepatic-duct", ta: "Ductus hepaticus communis", label: "Common Hepatic Duct", detail: "Carries bile away from the liver", color: "#7fa88a" },
    { id: "falciform-ligament", ta: "Ligamentum falciforme", label: "Falciform Ligament", detail: "Peritoneal fold separating the anatomical lobes", color: "#d89bc4" },
    { id: "porta-hepatis", ta: "Porta hepatis", label: "Porta Hepatis", detail: "Gateway where major vessels and ducts enter or leave", color: "#f2a33b" },
    { id: "right-hepatic-duct", ta: "Ductus hepaticus dexter", label: "Right Hepatic Duct", detail: "Drains bile from the right side of the liver", color: "#ee7c6a" },
    { id: "left-hepatic-duct", ta: "Ductus hepaticus sinister", label: "Left Hepatic Duct", detail: "Drains bile from the left side of the liver", color: "#ee7c6a" },
    { id: "ligamentum-teres", ta: "Ligamentum teres hepatis", label: "Round Ligament", detail: "Fibrous remnant of the fetal umbilical vein", color: "#c58696" },
  ],
  kidneys: [
    { id: "renal-pelvis", ta: "Pelvis renalis", label: "Renal Pelvis", detail: "Funnel that collects urine before the ureter", color: "#7fa88a" },
    { id: "renal-pyramid", ta: "Pyramides renales", label: "Renal Pyramid", detail: "Triangular region of the renal medulla", color: "#f2a33b" },
    { id: "renal-papilla", ta: "Papilla renalis", label: "Renal Papilla", detail: "Tip of a pyramid where urine enters a minor calyx", color: "#d89bc4" },
    { id: "renal-column", ta: "Columnae renales", label: "Renal Column", detail: "Cortical tissue extending between renal pyramids", color: "#ee7c6a" },
    { id: "renal-sinus", ta: "Sinus renalis", label: "Renal Sinus", detail: "Internal space containing the pelvis, vessels and fat", color: "#6393d8" },
    { id: "renal-hilum", ta: "Hilum renale", label: "Renal Hilum", detail: "Medial entry and exit point for vessels and ureter", color: "#7fa88a" },
    { id: "renal-artery", ta: "Arteria renalis", label: "Renal Artery", detail: "Carries blood from the aorta to the kidney", color: "#ee7c6a" },
    { id: "renal-vein", ta: "Vena renalis", label: "Renal Vein", detail: "Returns filtered blood to the inferior vena cava", color: "#6393d8" },
    { id: "major-calyx", ta: "Calix renalis major", label: "Major Calyx", detail: "Collects urine from several minor calyces", color: "#f2a33b" },
    { id: "minor-calyx", ta: "Calix renalis minor", label: "Minor Calyx", detail: "Receives urine from a renal papilla", color: "#d89bc4" },
    { id: "renal-capsule", ta: "Capsula fibrosa renis", label: "Renal Capsule", detail: "Fibrous covering around the kidney", color: "#c58696" },
    { id: "glomerulus", ta: "Glomerulus", label: "Glomerulus", detail: "Capillary tuft where filtration begins", color: "#ee7c6a" },
  ],
  eyeball: [
    { id: "sclera", ta: "Sclera", label: "Sclera", detail: "Tough outer coat of the eyeball", color: "#7fa88a" },
    { id: "lens", ta: "Lens crystallina", label: "Lens", detail: "Transparent structure that focuses light", color: "#f2a33b" },
    { id: "retina", ta: "Retina", label: "Retina", detail: "Neural tissue that detects light", color: "#d89bc4" },
    { id: "choroid", ta: "Choroidea", label: "Choroid", detail: "Vascular layer supplying the outer retina", color: "#6393d8" },
    { id: "ciliary-body", ta: "Corpus ciliare", label: "Ciliary Body", detail: "Changes lens shape during accommodation", color: "#ee7c6a" },
    { id: "vitreous-body", ta: "Corpus vitreum", label: "Vitreous Body", detail: "Gel filling most of the space behind the lens", color: "#7fa88a" },
    { id: "aqueous-humor", ta: "Humor aquosus", label: "Aqueous Humor", detail: "Fluid filling the anterior eye chambers", color: "#6393d8" },
    { id: "pupil", ta: "Pupilla", label: "Pupil", detail: "Opening that controls how much light enters", color: "#ee7c6a" },
    { id: "conjunctiva", ta: "Tunica conjunctiva", label: "Conjunctiva", detail: "Mucous membrane covering the front of the eye and inner eyelid", color: "#f2a33b" },
    { id: "macula", ta: "Macula lutea", label: "Macula", detail: "Retinal region specialised for detailed central vision", color: "#d89bc4" },
    { id: "optic-disc", ta: "Discus nervi optici", label: "Optic Disc", detail: "Point where the optic nerve leaves the eye", color: "#6393d8" },
    { id: "ciliary-muscle", ta: "Musculus ciliaris", label: "Ciliary Muscle", detail: "Muscle that adjusts tension on the lens", color: "#c58696" },
  ],
  intestine: [
    { id: "ileum", ta: "Ileum", label: "Ileum", detail: "Final segment of the small intestine", color: "#f2a33b" },
    { id: "cecum", ta: "Caecum", label: "Cecum", detail: "First pouch of the large intestine", color: "#7fa88a" },
    { id: "appendix", ta: "Appendix vermiformis", label: "Appendix", detail: "Lymphoid-rich tube attached to the cecum", color: "#d89bc4" },
    { id: "ascending-colon", ta: "Colon ascendens", label: "Ascending Colon", detail: "Right-sided portion of the large intestine", color: "#6393d8" },
    { id: "transverse-colon", ta: "Colon transversum", label: "Transverse Colon", detail: "Crosses the upper abdomen", color: "#ee7c6a" },
    { id: "descending-colon", ta: "Colon descendens", label: "Descending Colon", detail: "Left-sided portion of the large intestine", color: "#f2a33b" },
    { id: "sigmoid-colon", ta: "Colon sigmoideum", label: "Sigmoid Colon", detail: "S-shaped segment leading toward the rectum", color: "#7fa88a" },
    { id: "rectum", ta: "Rectum", label: "Rectum", detail: "Stores feces before elimination", color: "#d89bc4" },
    { id: "ileocecal-valve", ta: "Valva ileocaecalis", label: "Ileocecal Valve", detail: "Controls passage from ileum into the large intestine", color: "#6393d8" },
    { id: "mesentery", ta: "Mesenterium", label: "Mesentery", detail: "Supports intestines and carries vessels and nerves", color: "#c58696" },
    { id: "intestinal-villi", ta: "Villi intestinales", label: "Intestinal Villi", detail: "Finger-like projections that increase absorptive surface", color: "#ee7c6a" },
    { id: "anal-canal", ta: "Canalis analis", label: "Anal Canal", detail: "Terminal passage of the gastrointestinal tract", color: "#f2a33b" },
  ],
  pancreas: [
    { id: "uncinate-process", ta: "Processus uncinatus", label: "Uncinate Process", detail: "Hooked extension of the pancreatic head", color: "#7fa88a" },
    { id: "neck", ta: "Collum pancreatis", label: "Neck", detail: "Short region between the head and body", color: "#f2a33b" },
    { id: "splenic-artery", ta: "Arteria splenica", label: "Splenic Artery", detail: "Artery running along the superior border of the pancreas", color: "#ee7c6a" },
    { id: "splenic-vein", ta: "Vena splenica", label: "Splenic Vein", detail: "Vein running posterior to the pancreas", color: "#6393d8" },
    { id: "accessory-duct", ta: "Ductus pancreaticus accessorius", label: "Accessory Pancreatic Duct", detail: "Additional channel that may drain pancreatic secretions", color: "#d89bc4" },
    { id: "islets", ta: "Insulae pancreaticae", label: "Pancreatic Islets", detail: "Endocrine cell clusters that release hormones", color: "#c58696" },
    { id: "acini", ta: "Acini pancreatici", label: "Pancreatic Acini", detail: "Exocrine units that produce digestive enzymes", color: "#f2a33b" },
    { id: "common-bile-duct", ta: "Ductus choledochus", label: "Common Bile Duct", detail: "Carries bile toward the duodenum", color: "#7fa88a" },
    { id: "duodenal-loop", ta: "Duodenum", label: "Duodenum", detail: "First small-intestine segment surrounding the pancreatic head", color: "#ee7c6a" },
    { id: "pancreatic-neck-vessel", ta: "Vena portae hepatis", label: "Portal Vein", detail: "Forms behind the pancreatic neck from major tributaries", color: "#6393d8" },
    { id: "spleen", ta: "Lien", label: "Spleen", detail: "Adjacent organ at the pancreatic tail", color: "#d89bc4" },
  ],
  skin: [
    { id: "stratum-corneum", ta: "Stratum corneum", label: "Stratum Corneum", detail: "Outermost layer of dead, keratinised cells", color: "#ee7c6a" },
    { id: "stratum-basale", ta: "Stratum basale", label: "Stratum Basale", detail: "Deep epidermal layer where new keratinocytes arise", color: "#f2a33b" },
    { id: "papillary-dermis", ta: "Stratum papillare", label: "Papillary Dermis", detail: "Superficial dermal layer beneath the epidermis", color: "#d89bc4" },
    { id: "reticular-dermis", ta: "Stratum reticulare", label: "Reticular Dermis", detail: "Deeper dermal layer rich in collagen and elastic fibres", color: "#6393d8" },
    { id: "sweat-gland", ta: "Glandula sudorifera", label: "Sweat Gland", detail: "Produces sweat for thermoregulation", color: "#7fa88a" },
    { id: "sebaceous-gland", ta: "Glandula sebacea", label: "Sebaceous Gland", detail: "Produces sebum that lubricates skin and hair", color: "#f2a33b" },
    { id: "hair-shaft", ta: "Scapus pili", label: "Hair Shaft", detail: "Part of the hair extending above the skin surface", color: "#c58696" },
    { id: "hair-bulb", ta: "Bulbus pili", label: "Hair Bulb", detail: "Expanded base where hair growth is initiated", color: "#ee7c6a" },
    { id: "arrector-pili", ta: "Musculus arrector pili", label: "Arrector Pili Muscle", detail: "Small muscle attached to a hair follicle", color: "#6393d8" },
    { id: "sensory-receptor", ta: "Corpusculum lamellosum", label: "Sensory Receptor", detail: "Specialised receptor involved in detecting mechanical stimuli", color: "#d89bc4" },
    { id: "sweat-pore", ta: "Porus sudorifer", label: "Sweat Pore", detail: "Opening through which eccrine sweat reaches the surface", color: "#7fa88a" },
  ],
};

export function getHotspotCandidates(organId: OrganId) {
  return hotspotCandidates[organId] ?? [];
}
