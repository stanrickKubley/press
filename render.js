/*
  Press feature layout — shared by the site build (Node) and the editor preview (browser),
  so what she sees while writing is exactly what gets published.

  A post:  { publication, date, title?, link?, body, images: [{ image, placement, caption? }] }
  placement: "auto" | "left" | "right" | "center" | "full"
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PressRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Bold, italic and links come from the toolbar; pasted text can also bring headings, lists and quotes.
  function link(t, u) {
    var safe = /^(https?:|mailto:|\/|#)/i.test(u) ? u : "#";
    return '<a href="' + safe + '" target="_blank" rel="noopener">' + t + "</a>";
  }
  function inline(md) {
    var stash = [];
    var s = String(md).replace(/!\[[^\]]*\]\([^)]*\)/g, "") // pasted inline images are dropped; images go in the Images list
      .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, function (_, c) {
        stash.push(esc(c)); return "\u0000" + (stash.length - 1) + "\u0000";
      });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (_, t, u) { return link(t, u); });
    s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, function (_, u) { return link(u, u); });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, "$1<em>$2</em>");
    s = s.replace(/ {2,}\n|\n/g, "<br>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return stash[+i]; });
  }

  function paragraphs(body) {
    return String(body || "").replace(/\r/g, "").split(/\n\s*\n/)
      .map(function (p) { return p.trim(); }).filter(Boolean);
  }

  // One block of text: a heading, list, quote or plain paragraph.
  function block(b) {
    var lines = b.split("\n");
    var h = /^#{1,6}\s+(.*)$/.exec(b);
    if (h && lines.length === 1) return "<h3>" + inline(h[1].replace(/\s+#+\s*$/, "")) + "</h3>";
    if (lines.every(function (l) { return /^\s*>/.test(l); })) {
      var q = lines.map(function (l) { return l.replace(/^\s*>\s?/, ""); }).join("\n");
      return "<blockquote>" + paragraphs(q).map(function (p) { return "<p>" + inline(p) + "</p>"; }).join("") + "</blockquote>";
    }
    var ul = /^\s*[-*+]\s+/, ol = /^\s*\d+[.)]\s+/;
    var isList = function (re) {
      return re.test(lines[0]) && lines.every(function (l) { return re.test(l) || /^\s{2,}\S/.test(l); });
    };
    if (isList(ul) || isList(ol)) {
      var re = isList(ul) ? ul : ol, items = [];
      lines.forEach(function (l) { if (re.test(l)) items.push(l.replace(re, "")); else items[items.length - 1] += " " + l.trim(); });
      var tag = re === ul ? "ul" : "ol";
      return "<" + tag + ">" + items.map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + tag + ">";
    }
    return "<p>" + inline(b) + "</p>";
  }

  function slugify(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function formatDate(d) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(d || ""));
    if (!m) return "";
    return MONTHS[+m[2] - 1] + " " + m[1];
  }

  function figure(img, resolve, cls) {
    var src = resolve ? resolve(img.image) : img.image;
    if (!src) return "";
    var cap = img.caption ? "<figcaption>" + inline(img.caption) + "</figcaption>" : "";
    if (img.border) cls += " pf-border";
    return '<figure class="' + cls + '"><img src="' + esc(src) + '" alt="' + esc(img.caption || "") + '" loading="lazy">' + cap + "</figure>";
  }

  // ---- Auto size: pick Small / Medium / Large for good composition ----
  // Beside text: choose the size where the image and its text come out closest in height.
  // On its own line (or in a row): wide images go bigger, tall ones smaller, so they carry similar weight.
  var ROW = { xsmall: 1 / 4, small: 1 / 3, medium: 5 / 11, large: 2 / 3 };   // image's share of the row (matches press.css)
  var PAGE_W = 1100, GAP = 40, CHAR_W = 9.6, LINE_H = 27.2, PARA_GAP = 16, SCREEN_H = 820, MIN_TARGET = 450;
  function aspect(img) { var w = +img.w, h = +img.h; return w > 0 && h > 0 ? w / h : 0; }
  function plainLength(md) {
    return String(md || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_>#`\\]/g, "").replace(/^\s*([-+]|\d+[.)])\s+/gm, "").length;
  }
  function textHeight(list, width) {
    var perLine = Math.max(10, Math.floor(width / CHAR_W)), h = 0;
    list.forEach(function (p) { h += Math.max(1, Math.ceil(plainLength(p) / perLine)) * LINE_H; });
    return h + Math.max(0, list.length - 1) * PARA_GAP;
  }
  function autoBeside(img, list) {
    var ar = aspect(img); if (!ar) return "medium";
    var best = "medium", bestScore = Infinity;
    ["xsmall", "small", "medium", "large"].forEach(function (k) {
      var imgW = (PAGE_W - GAP) * ROW[k], txtW = (PAGE_W - GAP) - imgW;
      var ih = imgW / ar, th = textHeight(list, txtW);
      var score = Math.abs(Math.log(ih / Math.max(th, MIN_TARGET)));  // short text: size by shape instead
      if (ih > SCREEN_H) score += Math.log(ih / SCREEN_H) * 2;    // don't let an image run off the screen
      if (k === "medium") score -= ar >= 0.9 ? 0.4 : 0.15;          // lean toward Medium (less so for vertical images)
      if (k === "xsmall") score += 0.15;                            // Extra small only when clearly better                            // lean toward Medium unless another size is clearly better
      if (score < bestScore) { bestScore = score; best = k; }
    });
    return best;
  }
  var ALONE_MAX_H = 380, SUPPORT_MAX_H = 300;   // an image without text beside it shouldn't be taller than about half a screen
  function autoAlone(img) {
    var ar = aspect(img); if (!ar) return "medium";
    if (ar >= 1.7) return "large";                                   // very wide: give it room
    if ((PAGE_W * 0.5) / ar <= ALONE_MAX_H) return "medium";
    return (PAGE_W / 3) / ar <= 520 ? "small" : "xsmall";           // tall ones step down to Small; only very tall, narrow ones to Extra small
  }
  var STEP_DOWN = { large: "medium", medium: "small", small: "xsmall", xsmall: "xsmall" };
  function isManual(size) { return size === "xsmall" || size === "small" || size === "medium" || size === "large"; }
  // The first image in an entry leads; Auto makes every later image one step smaller so they support it.
  function pickSize(img, list, isLead) {
    if (isManual(img.size)) return img.size;
    var k = list ? autoBeside(img, list) : autoAlone(img);  // "auto" or missing
    if (isLead !== false) return k;
    if (k === "small" && aspect(img) >= 0.9) return "small";   // only vertical images step down to Extra small
    return STEP_DOWN[k];
  }

  // Lays out text and images: side images take turns left/right (unless she picked a side),
  // each gets a share of the paragraphs beside it; full-width images break the column;
  // images left over with no text to sit beside become a tidy row.
  function layout(post, resolve) {
    // Group paragraphs into "units" that each can sit beside an image. A short paragraph (a link line,
    // "order a copy here", etc.) never gets an image of its own: it joins the paragraph before it.
    // A subheading starts a new unit together with the paragraph after it.
    var SHORT = 160, units = [], carryHead = null;
    paragraphs(post.body).forEach(function (p) {
      if (/^#{1,6}\s/.test(p)) { carryHead = (carryHead || []).concat([p]); return; }
      if (carryHead) { units.push(carryHead.concat([p])); carryHead = null; return; }
      if (plainLength(p) < SHORT && units.length) units[units.length - 1].push(p);
      else units.push([p]);
    });
    if (carryHead) { if (units.length) units[units.length - 1] = units[units.length - 1].concat(carryHead); else units.push(carryHead); }
    if (units.length > 1 && units[0].length === 1 && plainLength(units[0][0]) < SHORT) units.splice(0, 2, units[0].concat(units[1]));
    var paras = units;   // each entry is now a list of paragraphs
    var flat = function (list) { return [].concat.apply([], list); };
    var images = (post.images || []).filter(function (i) { return i && i.image; });
    var lead = images[0];
    var side = images.filter(function (i) { var p = i.placement || "auto"; return p !== "full" && p !== "center"; });

    var shares = [], P = paras.length, S = side.length;
    for (var k = 0; k < S; k++) shares.push(Math.floor(P / S) + (k < P % S ? 1 : 0));
    if (S === 0) shares = [];

    // start_side is saved with the entry when it's created (opposite of the entry below it). Older entries start left.
    var out = [], pi = 0, si = 0, lastSide = post.start_side === "right" ? "left" : "right", pending = [];
    // Images with no paragraph beside them sit together in a row. Each keeps its own size;
    // the first image's Left/Right sets which side the row lines up on (Auto keeps alternating).
    function flushGallery() {
      if (!pending.length) return;
      var first = pending[0].placement || "auto";
      var align = first === "left" || first === "right" ? first : (lastSide === "left" ? "right" : "left");
      lastSide = align;
      var allAuto = pending.length > 1 && pending.every(function (i) { return !isManual(i.size); });
      if (allAuto) {
        // Auto-sized group: rows of up to 3, all the same height, filling the row together (like a gallery wall).
        for (var g = 0; g < pending.length; g += 3) {
          var row = pending.slice(g, g + 3);
          if (row.length === 1) { out.push('<div class="pf-gallery pf-align-' + align + '">' + figure(row[0], resolve, "pf-fig pf-" + pickSize(row[0], null, row[0] === lead)) + "</div>"); continue; }
          var ars = row.map(function (i) { return aspect(i) || 1; });
          var sum = ars.reduce(function (a, b) { return a + b; }, 0);
          var gaps = (row.length - 1) * 24;
          var maxH = row.indexOf(lead) >= 0 ? ALONE_MAX_H : SUPPORT_MAX_H;          // rows of later images stay lower
          var pct = Math.min(100, ((maxH * sum + gaps) / PAGE_W) * 100);           // keep the row from getting too tall
          out.push('<div class="pf-justify pf-align-' + align + '" style="width:' + pct.toFixed(2) + '%">' +
            row.map(function (i, k) { return figure(i, resolve, "pf-fig").replace('<figure class="pf-fig', '<figure style="flex:' + ars[k].toFixed(4) + ' 1 0" class="pf-fig'); }).join("") + "</div>");
        }
        pending = [];
        return;
      }
      out.push('<div class="pf-gallery pf-align-' + align + '">' +
        pending.map(function (i) {
          var sz = pickSize(i, null, i === lead);
          return figure(i, resolve, "pf-fig pf-" + sz);
        }).join("") + "</div>");
      pending = [];
    }
    function textHTML(list) { return list.map(block).join("").replace(/<\/(ul|ol)><\1>/g, ""); }

    images.forEach(function (img) {
      var place = img.placement || "auto";
      if (place === "full" || place === "center") {
        // On its own line: Full width spans the column; Center is centered at the chosen size.
        flushGallery();
        out.push(figure(img, resolve, "pf-fig pf-" + place + " pf-" + pickSize(img, null, img === lead)));
        return;
      }
      var n = shares[si++] || 0;
      if (n === 0) { pending.push(img); return; }
      flushGallery();
      var sideName = place === "left" || place === "right" ? place : (lastSide === "left" ? "right" : "left");
      lastSide = sideName;
      var size = pickSize(img, flat(paras.slice(pi, pi + n)), img === lead);
      out.push('<div class="pf-row pf-img-' + sideName + " pf-" + size + '">' + figure(img, resolve, "pf-fig") +
        '<div class="pf-text">' + textHTML(flat(paras.slice(pi, pi + n))) + "</div></div>");
      pi += n;
    });
    flushGallery();
    if (pi < P) out.push('<div class="pf-text pf-solo">' + textHTML(flat(paras.slice(pi))) + "</div>");
    return out.join("");
  }

  function postHTML(post, resolve, opts) {
    opts = opts || {};
    // Small line: "<publication> · <date>". Big heading: the headline, if there is one.
    // The article link goes on the publication name, else on the headline, else a "Read the article" link.
    var pub = post.show_publication !== false ? esc((post.publication || "").trim()) : "";
    var href = post.link ? esc(post.link) : "";
    var a = function (inner) { return '<a href="' + href + '" target="_blank" rel="noopener">' + inner + "</a>"; };
    var title = post.show_title !== false ? esc((post.title || "").trim()) : "";
    var date = post.show_date !== false ? formatDate(post.date) : "";
    var bits = [];
    if (pub) bits.push(href ? a(pub) : pub);
    if (date) bits.push(date);
    if (href && !pub && !title) bits.push(a("Read the article"));
    var h2 = title ? (href && !pub ? a(title) : title) : "";
    var head = (bits.length ? '<p class="pf-kicker">' + bits.join(" · ") + "</p>" : "") + (h2 ? "<h2>" + h2 + "</h2>" : "");
    var id = opts.id ? ' id="' + esc(opts.id) + '"' : "";
    return '<article class="pf-post"' + id + ">" + (head ? "<header>" + head + "</header>" : "") + layout(post, resolve) + "</article>";
  }

  function bodyHTML(md) {
    return paragraphs(md).map(block).join("").replace(/<\/(ul|ol)><\1>/g, "");
  }

  return { pickSize: pickSize, postHTML: postHTML, layout: layout, inline: inline, bodyHTML: bodyHTML, slugify: slugify, formatDate: formatDate };
});
