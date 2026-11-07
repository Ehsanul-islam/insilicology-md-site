/**
 * Whether visitors may download figures and raw output files. Off by default: the pages still show the
 * figures and plots, but no download buttons are shown and the file route only serves inline images.
 * Set NEXT_PUBLIC_DOWNLOADS_ENABLED=true (and redeploy) to turn downloads back on.
 */
export const DOWNLOADS_ENABLED = process.env.NEXT_PUBLIC_DOWNLOADS_ENABLED === "true";
