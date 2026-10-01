# Preventive-care assets — 7 REAL JPG photographs

Source of truth: the 7 manually-uploaded JPGs below, wired via STATIC
require() calls in `src/components/healthcare/preventiveItems.ts`.

images/ (REAL photos — displayed in the carousel):
  preventive-01-elderly-checkup.jpg
  preventive-02-medical-team.jpg
  preventive-03-bp-check.jpg
  preventive-04-patient-consult.jpg
  preventive-05-community-outreach.jpg
  preventive-06-heart-checkup.jpg
  preventive-07-child-checkup.jpg

The inactive carousel contains exactly THESE 7 photos, ping-ponging
1→2→3→4→5→6→7→6→5→4→3→2→1→2… forever (never 7→1), 4s each, 7 dots.

Out-of-scope notes:
- The older `preventive-01…09.svg` cartoon files in this folder are NOT used
  as primary media anymore. They remain only as unused archive files.
- Video slots 8–9 were removed (videos deleted). No video logic runs in the
  active 7-photo carousel.
