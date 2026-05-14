export const OFFICIAL_OPENSCAD_DOWNLOAD_URL = 'https://openscad.org/downloads.html';
export const OFFICIAL_OPENSCAD_SUPPORT_URL = 'https://openscad.org/community.html';

const OPENSCAD_SUPPORT_PATTERNS = [
  /OpenSCAD executable not found/i,
  /OpenSCAD executable could not be launched/i,
  /Install OpenSCAD from/i,
  /openscad\.org\/downloads/i,
];

function getIssueMessage(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.message || entry?.detail || '';
}

export function shouldShowOpenScadSupport(issues = []) {
  return issues
    .map(getIssueMessage)
    .some((message) => OPENSCAD_SUPPORT_PATTERNS.some((pattern) => pattern.test(message)));
}

export function buildOpenScadSupportMessage() {
  return 'Forge3D renders through the official OpenSCAD command-line app. Install OpenSCAD from the official OpenSCAD downloads page, then restart Forge3D. If you installed it somewhere custom, set FORGE3D_OPENSCAD_BIN to the executable path.';
}
