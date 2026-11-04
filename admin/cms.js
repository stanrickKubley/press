// Editor setup: the fields she sees, and a live preview that uses the real page layout.
(function () {
  var demo = window.PRESS_DEMO === true;

  var config = {
    load_config_file: false,
    backend: demo ? { name: "test-repo" } : { name: "git-gateway", branch: "main" },
    media_folder: "images/uploads",
    public_folder: demo ? "images/uploads" : "/images/uploads",
    site_url: demo ? undefined : "/",
    display_url: demo ? undefined : "/",
    collections: [{
      name: "features",
      label: "Publications",
      label_singular: "Entry",
      description: "Each entry is one story on the Publications page. Newest appear first.",
      folder: demo ? "posts" : "content/posts",
      format: "json",
      extension: "json",
      create: true,
      identifier_field: "title",
      slug: "{{year}}-{{month}}-{{day}}-{{hour}}{{minute}}{{second}}",
      summary: "{{date | date('MMM D, YYYY')}} · {{title | default('No headline')}} · {{draft | ternary('Draft', 'Published')}}{{pinned | ternary(' · Pinned', '')}}",
      sortable_fields: ["date", "title"],
      fields: [
        { name: "draft", label: "Draft", widget: "draftcheck", default: false, required: false },
        { name: "pinned", label: "Pin to the top", widget: "pincheck", default: false, required: false },
        { name: "preview_tools", label: "Preview", widget: "pressPreview", required: false },
        { name: "publication", label: "Publication", widget: "string", required: false,
          hint: "This will list the publication small, next to the date." },
        { name: "show_publication", label: "Show the publication", widget: "showcheck", default: true, required: false,
          text: "Show the publication name on the page" },
        { name: "date", label: "Date", widget: "day",
          hint: "This will list the date above the post, or it will be used to sort the post." },
        { name: "show_date", label: "Show the date", widget: "showcheck", default: true, required: false,
          text: "Show the date on the page" },
        { name: "title", label: "Headline", widget: "string", required: false,
          hint: "This will add a larger, thicker title above the post." },
        { name: "show_title", label: "Show the headline", widget: "showcheck", default: true, required: false,
          text: "Show the headline on the page" },
        { name: "link", label: "Link to the article", widget: "string", required: false,
          hint: "This makes the publication name clickable. If the publication is hidden, the headline is clickable instead." },
        { name: "body", label: "Text", widget: "presstext" },
        { name: "start_side", label: "First image side", widget: "startside", required: false },
        { name: "images", label: "Images", widget: "pressimages", required: false,
          hint: "Shown on the page in this order. Use ↑ ↓ to reorder." }
      ]
    }]
  };

  if (demo) { delete config.site_url; delete config.display_url; }
  // No room for the side-by-side preview on a phone, so the editor is a single column there.
  if (window.innerWidth < 800) config.collections[0].editor = { preview: false };
  window.PRESS_PATHS = { media: config.media_folder, public: config.public_folder };

  CMS.registerPreviewStyle("https://fonts.googleapis.com/css2?family=Abel&family=Source+Code+Pro:ital,wght@0,300;0,400;0,500;1,300&display=swap");
  CMS.registerPreviewStyle(window.PRESS_CSS || "press.css", window.PRESS_CSS ? { raw: true } : undefined);

  var Preview = createClass({
    componentDidMount: function () { var self = this; this.unlisten = window.PressAsset.onChange(function () { self.forceUpdate(); }); },
    componentWillUnmount: function () { if (this.unlisten) this.unlisten(); },
    render: function () {
      var data = this.props.entry.get("data");
      var post = data && data.toJS ? data.toJS() : {};
      var resolve = function (p) {
        if (!p) return "";
        window.PressAsset.ensure(p);
        return window.PressAsset.url(p);
      };
      var html = window.PressRender.postHTML(post, resolve);
      return h("div", { className: "pf-page", style: { paddingTop: "2.5rem" } },
        h("div", { dangerouslySetInnerHTML: { __html: html } }));
    }
  });
  CMS.registerPreviewTemplate("features", Preview);

  // Tap-button picker (used for image placement and size) instead of a dropdown.
  var Buttons = createClass({
    render: function () {
      var field = this.props.field, onChange = this.props.onChange;
      var opts = field.get("options");
      opts = opts && opts.toJS ? opts.toJS() : [];
      var value = this.props.value || field.get("default");
      return h("div", { className: this.props.classNameWrapper, id: this.props.forID, role: "group",
          style: { display: "flex", flexWrap: "wrap", gap: "6px", padding: "10px" } },
        opts.map(function (o) {
          var on = o.value === value;
          return h("button", {
            key: o.value, type: "button", "aria-pressed": on,
            onClick: function () { onChange(o.value); },
            style: { padding: "8px 14px", borderRadius: "999px", cursor: "pointer", font: "inherit", fontSize: "14px",
              border: "1px solid " + (on ? "#3a4a7a" : "#cfd2d8"), background: on ? "#3a4a7a" : "#fff", color: on ? "#fff" : "#313d3e" }
          }, o.label);
        }));
    }
  });
  CMS.registerWidget("buttons", Buttons);

  // Date picker without a time. Starts as today.
  var Day = createClass({
    componentDidMount: function () {
      if (!this.props.value) {
        var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
        this.props.onChange(d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()));
      }
    },
    render: function () {
      var onChange = this.props.onChange;
      return h("input", { type: "date", id: this.props.forID, className: this.props.classNameWrapper,
        value: this.props.value || "", onChange: function (e) { onChange(e.target.value); },
        style: { fontSize: "15px" } });
    }
  });
  CMS.registerWidget("day", Day);
  CMS.registerWidget("presstext", window.PressTextControl());
  CMS.registerWidget("pressimages", window.PressImagesControl());

  // "Show on the page" checkbox: a plain line right under the field it controls, not a separate box.
  var ShowCheck = createClass({
    render: function () {
      var on = this.props.value !== false, onChange = this.props.onChange;
      return h("label", { className: "pc-show" },
        h("input", { type: "checkbox", id: this.props.forID, checked: on, onChange: function (e) { onChange(e.target.checked); } }),
        h("span", null, this.props.field.get("text") || this.props.field.get("label")));
    }
  });
  CMS.registerWidget("showcheck", ShowCheck);

  // "Draft" switch at the top: a draft is saved but kept off the page until it's unchecked and published again.
  var DraftCheck = createClass({
    componentWillUnmount: function () { document.body.classList.remove("pc-is-draft"); },
    render: function () {
      var on = this.props.value === true, onChange = this.props.onChange;
      document.body.classList.toggle("pc-is-draft", on);
      return h("label", { className: "pc-draft" + (on ? " is-on" : "") },
        h("input", { type: "checkbox", id: this.props.forID, checked: on, onChange: function (e) { onChange(e.target.checked); } }),
        h("span", null, h("strong", null, "Draft"), " — keep this entry off the page for now. Uncheck it and press Publish when it's ready."));
    }
  });
  CMS.registerWidget("draftcheck", DraftCheck);

  // "Pin to the top": a pinned entry shows first on the page, above newer ones.
  var PinCheck = createClass({
    render: function () {
      var on = this.props.value === true, onChange = this.props.onChange;
      return h("label", { className: "pc-show pc-pin" },
        h("input", { type: "checkbox", id: this.props.forID, checked: on, onChange: function (e) { onChange(e.target.checked); } }),
        h("span", null, "Pin to the top of the page"));
    }
  });
  CMS.registerWidget("pincheck", PinCheck);

  // While Draft is checked, Decap's toolbar still says "Publish" / "Published". Tag those labels so the
  // stylesheet below can show draft wording instead (Decap redraws its toolbar, so keep tagging).
  var DRAFT_WORDS = { "Published": "Draft saved", "Publish": "Save draft", "Publishing…": "Saving…", "Publishing...": "Saving…",
    "Publish now": "Save draft", "Publish and create new": "Save draft and create new", "Publish and duplicate": "Save draft and duplicate" };
  function tagLabels(root) {
    root.querySelectorAll("[data-pc-draft]").forEach(function (el) { if (!DRAFT_WORDS[el.textContent.trim()]) el.removeAttribute("data-pc-draft"); });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = walker.nextNode())) {
      var t = n.nodeValue.trim(), el = n.parentElement;
      if (!el || !DRAFT_WORDS[t]) continue;
      if (el.childNodes.length === 1) { if (el.getAttribute("data-pc-draft") !== DRAFT_WORDS[t]) el.setAttribute("data-pc-draft", DRAFT_WORDS[t]); }
    }
  }
  // Top bar: a plain "Log out" link instead of Decap's person-shaped menu (it had nothing else in it).
  function addLogout() {
    var bar = document.querySelector("[class*='-AppHeaderActions']");
    if (!bar || bar.querySelector(".pc-logout")) return;
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "pc-logout"; btn.textContent = "Log out";
    btn.addEventListener("click", function () {
      var id = window.netlifyIdentity;
      var done = function () { location.reload(); };
      try { var r = id && id.logout && id.logout(); if (r && r.then) r.then(done, done); else setTimeout(done, 300); } catch (e) { done(); }
    });
    bar.appendChild(btn);
  }
  // Entry list: mark each row with its status so drafts can be tinted.
  function tagRows() {
    document.querySelectorAll("[class*='-ListCardTitle']").forEach(function (el) {
      var st = /· Draft( · Pinned)?$/.test(el.textContent.trim()) ? "draft" : "published";
      if (el.getAttribute("data-pc-status") !== st) el.setAttribute("data-pc-status", st);
      var card = el.closest("[class*='-ListCard-']");
      if (card && card.getAttribute("data-pc-status") !== st) card.setAttribute("data-pc-status", st);
    });
  }
  new MutationObserver(function () { tagLabels(document.body); addLogout(); tagRows(); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  // Which side the first image starts on. Set once when the entry is created (opposite of the newest entry
  // already on the page), then saved with the entry so it never changes. She can switch it.
  function loadEntries() {
    if (window.PRESS_ENTRIES) return Promise.resolve(window.PRESS_ENTRIES);
    return fetch("/entries.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }
  var StartSide = createClass({
    componentDidMount: function () {
      var self = this, entry = this.props.entry;
      var isNew = entry && entry.get && entry.get("newRecord");
      if (this.props.value || !isNew) return;
      loadEntries().then(function (list) {
        var newest = (list || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0];
        if (!self.props.value) self.props.onChange(newest && newest.start_side === "left" ? "right" : "left");
      });
    },
    render: function () {
      var side = this.props.value === "right" ? "right" : "left", onChange = this.props.onChange;
      var other = side === "left" ? "right" : "left";
      return h("div", { className: "pc-side", id: this.props.forID },
        h("span", null, "First image starts on the " + side + " (set to alternate with the entry below). "),
        h("button", { type: "button", onClick: function () { onChange(other); } }, "Switch to " + other));
    }
  });
  CMS.registerWidget("startside", StartSide);
  CMS.registerWidget("pressPreview", window.PressPreviewControl());

  // Phones: Decap's editor screen and its top bar have an 800px minimum width. Let them fit the screen,
  // wrap the top bar so Save and Publish stay visible, and hide the side preview (no room for it).
  (function () {
    var css =
      // Show-on-page checkboxes: hide their grey label tab and tuck them up under the field above.
      "label[for^='draft'],label[for^='pinned'],label[for^='show_publication'],label[for^='show_date'],label[for^='show_title'],label[for^='start_side'],label[for^='preview_tools']{display:none!important}" +
      ".pv-launch button{font:inherit;font-size:14px;padding:10px 16px;border-radius:6px;border:1px solid #1d1f22;background:#fff;color:#1d1f22;cursor:pointer;width:100%}" +
      ".pv-launch button:hover{background:#f6f7f9}" +
      // Decap's own "Check for Preview" (deploy previews) would be confused with ours.
      "[class*='-PreviewButtonContainer']{display:none!important}" +
      ".pc-side{font-size:13px;color:#5d626f;margin:-14px 0 -10px}" +
      ".pc-side button{font:inherit;font-size:13px;color:#3a4a7a;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer}" +
      // Draft wording on Decap's toolbar: hide the original word, show ours.
      "body.pc-is-draft [data-pc-draft]{font-size:0!important}" +
      "body.pc-is-draft [data-pc-draft]::before{content:attr(data-pc-draft);font-size:14px}" +
      ".pc-draft{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #cfd2d8;border-radius:6px;background:#fff;font-size:14px;color:#313d3e;cursor:pointer}" +
      ".pc-draft.is-on{background:#fff6dc;border-color:#d9b44a}" +
      ".pc-draft input{width:18px;height:18px;margin:0;accent-color:#3a4a7a;cursor:pointer;flex:none}" +
      ".pc-show{display:flex;align-items:center;gap:10px;margin:-14px 0 0;padding:0 2px;font-size:14px;color:#313d3e;cursor:pointer}" +
      ".pc-show input{width:18px;height:18px;margin:0;accent-color:#3a4a7a;cursor:pointer}" +
      "@media (max-width: 799px) {" +
      ".pv-launch button{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:auto;z-index:1000;border-radius:999px;padding:12px 20px;box-shadow:0 4px 14px rgba(0,0,0,.25);background:#1d1f22;color:#fff;border-color:#1d1f22}" +
      "[class*='-EditorContainer'],[class*='-ToolbarContainer']{min-width:0!important;width:100%!important}" +
      "[class*='-ToolbarContainer']{height:auto!important;flex-wrap:wrap}" +
      "[class*='-ToolbarSectionMain']{flex-wrap:wrap;row-gap:6px;padding:6px 0}" +
      "[class*='-ToolbarSectionBackLink']{min-width:0!important}" +
      "[class*='-ViewControls']{display:none!important}" +
      "}";
    var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
  })();

  // Decap keeps its own copy of the entry list and doesn't refresh it after a save, so the list could show an old
  // status. Coming back to the list from an entry reloads it. (Decap changes pages without a "hashchange" event,
  // so watch the address on every redraw.)
  var lastHash = location.hash;
  function checkHash() {
    var h = location.hash;
    if (h === lastHash) return;
    var fromEntry = /\/collections\/[^/]+\/(entries\/|new)/.test(lastHash);
    var toList = /^#\/collections\/[^/]+\/?$/.test(h);
    lastHash = h;
    if (fromEntry && toList) location.reload();
  }
  new MutationObserver(checkHash).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", checkHash);
  window.addEventListener("hashchange", checkHash);

  if (window.PRESS_DEMO_READY) window.PRESS_DEMO_READY.then(function () { CMS.init({ config: config }); });
  else CMS.init({ config: config });
})();
