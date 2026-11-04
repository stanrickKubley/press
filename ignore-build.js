// Netlify runs this before each build. Exit 0 = skip the build, 1 = build.
// Every build of the live page costs credits on the free plan, so changes that can't alter the page
// are skipped: saving a draft entry, deleting a draft, and uploading its images.
const { execSync } = require("child_process");

const BUILD = 1, SKIP = 0;
const from = process.env.CACHED_COMMIT_REF, to = process.env.COMMIT_REF || "HEAD";
if (!from || from === to) process.exit(BUILD);

const git = (cmd) => execSync("git " + cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const isDraft = (ref, file) => {
  try { return JSON.parse(git(`show ${ref}:${file}`)).draft === true; }
  catch (e) { return null; } // file didn't exist at that commit
};

try {
  const files = git(`diff --name-only ${from} ${to}`).split("\n").filter(Boolean);
  if (!files.length) process.exit(BUILD);
  for (const f of files) {
    if (f.startsWith("images/uploads/")) continue; // an image only shows once a published entry uses it
    if (/^content\/posts\/[^/]+\.json$/.test(f)) {
      const before = isDraft(from, f), after = isDraft(to, f);
      // Skippable only if the entry was never on the page before or after this change.
      if (before !== false && after !== false) continue;
    }
    console.log("Building: " + f + " changed");
    process.exit(BUILD);
  }
  console.log("Skipping build: only drafts or images changed");
  process.exit(SKIP);
} catch (e) {
  process.exit(BUILD);
}
