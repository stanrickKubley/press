// Builds the press page. No dependencies: Netlify runs `node build.js` on every publish.
const fs = require("fs");
const path = require("path");
const { postHTML, slugify } = require("./render.js");

const SITE = {
  name: "Mindy Kober",
  title: "Publications",                    // browser tab: "Publications — Mindy Kober"
  homeUrl: "https://www.mindykober.com",    // her Squarespace site
  // Same menu as her site. "Publications" is this page.
  nav: [["Artwork", "/artwork"], ["Past Work", "/past-work"], ["Bio", "/bio"], ["Publications", null], ["Contact", "/contact"]],
  instagram: "https://instagram.com/kobermindy",
};

const ROOT = __dirname;
const OUT = path.join(ROOT, process.argv[2] || "_site");
const POSTS = path.join(ROOT, "content", "posts");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, f.name), d = path.join(dest, f.name);
    f.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const posts = (fs.existsSync(POSTS) ? fs.readdirSync(POSTS) : [])
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(POSTS, f), "utf8")) }))
  .filter((p) => p.draft !== true) // drafts stay off the page
  // Pinned entries first; then newest date first; entries on the same day: the one created last goes first
  // (file names carry the creation time).
  .sort((a, b) => (b.pinned === true) - (a.pinned === true)
    || String(b.date).localeCompare(String(a.date)) || b.file.localeCompare(a.file));

const used = new Set();
const feed = posts.map((p) => {
  let id = slugify(`${String(p.date).slice(0, 7)} ${p.title || p.publication}`) || "feature";
  while (used.has(id)) id += "-2";
  used.add(id);
  return postHTML(p, null, { id });
}).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${SITE.title} — ${SITE.name}</title>
<link rel="icon" type="image/png" href="/images/favicon.png">
<link rel="apple-touch-icon" href="/images/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abel&family=Source+Code+Pro:ital,wght@0,300;0,400;0,500;1,300&display=swap">
<link rel="stylesheet" href="press.css">
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
</head>
<body>
<main class="pf-page">
  <header class="pf-site">
    <a class="pf-name" href="${SITE.homeUrl}/">${SITE.name}</a>
    <nav class="pf-nav" aria-label="Main">
      ${SITE.nav.map(([label, href]) => href ? `<a href="${SITE.homeUrl}${href}">${label}</a>` : `<a href="/" aria-current="page">${label}</a>`).join("\n      ")}
      ${SITE.instagram ? `<a class="pf-ig" href="${SITE.instagram}" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg></a>` : ""}
    </nav>
  </header>
  <h1 class="pf-sr">${SITE.title}</h1>
  <div class="pf-feed">
${feed || '<p class="pf-empty">No features yet.</p>'}
  </div>
  <footer class="pf-footer"><p>© ${new Date().getFullYear()} ${SITE.name.toUpperCase()}</p></footer>
</main>
<script>
  // Sends her to the editor after she accepts the invite email.
  if (window.netlifyIdentity) netlifyIdentity.on("init", (u) => { if (!u) netlifyIdentity.on("login", () => { location.href = "/admin/"; }); });
</script>
</body>
</html>
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), html);
// For the editor: which side each published entry's first image starts on, so a new entry can take the other side.
fs.writeFileSync(path.join(OUT, "entries.json"), JSON.stringify(posts.map((p) => ({ date: p.date, start_side: p.start_side === "right" ? "right" : "left" }))));
fs.copyFileSync(path.join(ROOT, "press.css"), path.join(OUT, "press.css"));
copyDir(path.join(ROOT, "images"), path.join(OUT, "images"));
copyDir(path.join(ROOT, "admin"), path.join(OUT, "admin"));
fs.copyFileSync(path.join(ROOT, "render.js"), path.join(OUT, "admin", "render.js"));
fs.copyFileSync(path.join(ROOT, "press.css"), path.join(OUT, "admin", "press.css"));
// The site header, for the editor's full-screen preview.
fs.writeFileSync(path.join(OUT, "admin", "header.html"), (html.match(/<header class="pf-site">[\s\S]*?<\/header>/) || [""])[0]);
console.log(`Built ${posts.length} feature(s) into ${path.relative(ROOT, OUT)}/`);
