// ─── CREST People Directory ────────────────────────────────────────────────────
// Source: Glean org data, April 2026
// Covers: Solutions & Implementation team (CSEs, COMs, IMs) + EMEA CSMs + EMEA AEs
// Email is the primary key — used to link Firebase Google SSO accounts to people

export const ROLES = {
  CSE:     "Customer Success Engineer",
  COM:     "Customer Onboarding Manager",
  IM:      "Implementation Manager",
  CSM:     "Customer Success Manager",
  AE:      "Account Executive",
  MANAGER: "Manager",
};

export const PEOPLE = [
  // ── Solutions & Implementation (Edwin Davidian's team) ──────────────────────
  {
    email:       "edwin.davidian@safetyculture.io",
    name:        "Edwin Davidian",
    initials:    "ED",
    role:        ROLES.MANAGER,
    roleKey:     "manager",
    title:       "Manager, Customer Solutions & Implementation",
    location:    "Remote: UK",
    team:        "Solutions & Implementation",
  },
  {
    email:       "ben.edwards@safetyculture.io",
    name:        "Ben Edwards",
    initials:    "BE",
    role:        ROLES.CSE,
    roleKey:     "cse",
    title:       "Senior Customer Success Engineer",
    location:    "Manchester",
    team:        "Solutions & Implementation",
  },
  {
    email:       "jeanfrancoispypops@safetyculture.io",
    name:        "Jean-François Pypops",
    initials:    "JF",
    role:        ROLES.CSE,
    roleKey:     "cse",
    title:       "Senior Customer Success Engineer",
    location:    "Remote: UK",
    team:        "Solutions & Implementation",
  },
  {
    email:       "leo.furlan@safetyculture.io",
    name:        "Léo Furlan",
    initials:    "LF",
    role:        ROLES.CSE,
    roleKey:     "cse",
    title:       "Technical Sales Engineer",
    location:    "Amsterdam",
    team:        "Solutions & Implementation",
  },
  {
    email:       "alice.kirkup@safetyculture.io",
    name:        "Alice Kirkup",
    initials:    "AK",
    role:        ROLES.COM,
    roleKey:     "com",
    title:       "Customer Onboarding Manager",
    location:    "Manchester",
    team:        "Solutions & Implementation",
  },
  {
    email:       "michele.riedl@safetyculture.io",
    name:        "Michele Riedl",
    initials:    "MR",
    role:        ROLES.COM,
    roleKey:     "com",
    title:       "Customer Onboarding Manager",
    location:    "Amsterdam",
    team:        "Solutions & Implementation",
  },
  {
    email:       "rebecca.critchley@safetyculture.io",
    name:        "Rebecca Critchley",
    initials:    "RC",
    role:        ROLES.COM,
    roleKey:     "com",
    title:       "Senior Customer Onboarding Manager",
    location:    "Manchester",
    team:        "Solutions & Implementation",
  },
  {
    email:       "tom.corfield@safetyculture.io",
    name:        "Tom Corfield",
    initials:    "TC",
    role:        ROLES.IM,
    roleKey:     "im",
    title:       "Implementation Manager",
    location:    "Remote: UK",
    team:        "Solutions & Implementation",
  },

  // ── EMEA Customer Success Managers (Pascale Radford's team) ─────────────────
  {
    email:       "pascale.radford@safetyculture.io",
    name:        "Pascale Radford",
    initials:    "PR",
    role:        ROLES.MANAGER,
    roleKey:     "manager",
    title:       "Manager, Customer Success",
    location:    "Remote: UK",
    team:        "Customer Success",
  },
  {
    email:       "mollie.irving@safetyculture.io",
    name:        "Mollie Irving",
    initials:    "MI",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },
  {
    email:       "hanaa.ashraf@safetyculture.io",
    name:        "Hanaa Ashraf",
    initials:    "HA",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },
  {
    email:       "liv.douglas@safetyculture.io",
    name:        "Liv Prior",
    initials:    "LP",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },
  {
    email:       "chiedza.mazarire@safetyculture.io",
    name:        "Chedz Mazarire",
    initials:    "CM",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },
  {
    email:       "odette.colebrook@safetyculture.io",
    name:        "Odette Colebrook",
    initials:    "OC",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },
  {
    email:       "vanessa.dsouza@safetyculture.io",
    name:        "Vanessa D'Souza",
    initials:    "VD",
    role:        ROLES.CSM,
    roleKey:     "csm",
    title:       "Senior Customer Success Manager",
    location:    "Manchester",
    team:        "Customer Success",
  },

  // ── EMEA Account Executives (Dawid Jaworski's teams) ────────────────────────
  {
    email:       "emiliano.muco@safetyculture.io",
    name:        "Emiliano Muco",
    initials:    "EM",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Strategic Account Executive",
    location:    "Remote: UK",
    team:        "Sales EMEA",
  },
  {
    email:       "zohaib.rehman@safetyculture.io",
    name:        "Zohaib Rehman",
    initials:    "ZR",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
  {
    email:       "imani.brocklehurst@safetyculture.io",
    name:        "Imani Brocklehurst",
    initials:    "IB",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Senior Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
  {
    email:       "jess.caird@safetyculture.io",
    name:        "Jess Caird",
    initials:    "JC",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Account Executive",
    location:    "Remote: UK",
    team:        "Sales EMEA",
  },
  {
    email:       "jake.cooperwoolley@safetyculture.io",
    name:        "Jake Cooper-Woolley",
    initials:    "JCW",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
  {
    email:       "olivia.langley@safetyculture.io",
    name:        "Olivia Langley",
    initials:    "OL",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Senior Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
  {
    email:       "karo.bolanowska@safetyculture.io",
    name:        "Karolina Bolanowska",
    initials:    "KB",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
  {
    email:       "ralph.pillmoor@safetyculture.io",
    name:        "Ralph Pillmoor",
    initials:    "RP",
    role:        ROLES.AE,
    roleKey:     "ae",
    title:       "Account Executive",
    location:    "Manchester",
    team:        "Sales EMEA",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get all people of a given role key: "cse" | "com" | "im" | "csm" | "ae" | "manager" */
export function byRole(roleKey) {
  return PEOPLE.filter(p => p.roleKey === roleKey);
}

/** Get all COMs (for COM assignment dropdowns) */
export const COMS = byRole("com");

/** Get all CSMs */
export const CSMS = byRole("csm");

/** Get all AEs */
export const AES = byRole("ae");

/** Get all CSEs */
export const CSES = byRole("cse");

/** Look up a person by email address (used during Firebase sign-in to link accounts) */
export function personByEmail(email) {
  if (!email) return null;
  return PEOPLE.find(p => p.email.toLowerCase() === email.toLowerCase()) || null;
}

/** Look up a person by name (for legacy string fields) */
export function personByName(name) {
  if (!name) return null;
  return PEOPLE.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * All people relevant to a given field type.
 * Used to populate dropdowns.
 */
export function peopleForField(field) {
  switch (field) {
    case "csm":   return CSMS;
    case "com":   return COMS;
    case "ae":    return AES;
    case "cse":   return CSES;
    case "owner": return [...CSES, ...COMS, byRole("im"), byRole("manager")].flat();
    case "all":   return PEOPLE;
    default:      return PEOPLE;
  }
}
