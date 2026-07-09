/* ============ Neural-network animated backdrop ============ */
(function neuralNetwork() {
  const canvas = document.getElementById("neuralCanvas");
  if (!canvas) return;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");

  let w, h, dpr, nodes = [];
  const mouse = { x: -9999, y: -9999 };

  // Read brand colours from CSS variables so the net matches the active theme.
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }
  let nodeRGB, lineRGB, baseOpacity;
  function readColors() {
    nodeRGB = cssVar("--net-node", "129, 140, 248");
    lineRGB = cssVar("--net-line", "168, 85, 247");
    baseOpacity = parseFloat(cssVar("--net-opacity", "0.55")) || 0.55;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Particle count scales with screen area (kept modest for performance).
    const count = Math.min(90, Math.round((w * h) / 16000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.8,
    }));
  }

  const LINK_DIST = 130;
  const MOUSE_DIST = 170;

  function frame() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      // links between near nodes
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const dx = n.x - m.x, dy = n.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK_DIST) {
          ctx.strokeStyle = `rgba(${lineRGB}, ${baseOpacity * (1 - d / LINK_DIST) * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
      }

      // link to mouse for interactive feel
      const mdx = n.x - mouse.x, mdy = n.y - mouse.y;
      const md = Math.hypot(mdx, mdy);
      if (md < MOUSE_DIST) {
        ctx.strokeStyle = `rgba(${nodeRGB}, ${baseOpacity * (1 - md / MOUSE_DIST)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }

      ctx.fillStyle = `rgba(${nodeRGB}, ${baseOpacity + 0.15})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  function drawStatic() {
    // Single non-animated render for reduced-motion users.
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const m = nodes[j];
        const d = Math.hypot(n.x - m.x, n.y - m.y);
        if (d < LINK_DIST) {
          ctx.strokeStyle = `rgba(${lineRGB}, ${baseOpacity * (1 - d / LINK_DIST) * 0.4})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${nodeRGB}, ${baseOpacity})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener("mouseout", () => { mouse.x = -9999; mouse.y = -9999; });
  window.addEventListener("resize", () => { resize(); if (reduce) drawStatic(); }, { passive: true });

  readColors();
  resize();
  if (reduce) drawStatic();
  else requestAnimationFrame(frame);

  // Expose a recolor hook so the theme toggle can refresh particle colours.
  window.__neuralRecolor = () => { readColors(); if (reduce) drawStatic(); };
})();

/* ============ Project data — edit this list to add your own ============ */
const projects = [
  {
    title: "SkillRoute", icon: "🧭", category: "Web",
    link: "https://skill-route-rho.vercel.app",
    github: "https://github.com/tabindafayaz1111/SkillRoute",
    desc: "An interactive learning platform — think Duolingo + Brilliant + Kaggle Learn — with 23 courses across 5 tracks: AI/ML, Web & Full-Stack, Programming Languages, Data & Analytics, and AI Engineering. Features a live in-browser code playground (Pyodide/WASM), a real AI mentor powered by Claude, XP gamification, certificates, a command-palette search, and an animated AI-particle hero.",
    tags: ["Full Stack", "JavaScript", "HTML", "CSS", "AI Mentor", "Gamification", "Pyodide", "Vercel"],
  },
  {
    title: "Heart Disease Prediction", icon: "❤️", category: "Machine Learning",
    link: "https://heartdiseasepredictionusing-knn-git-d2r.streamlit.app/",
    desc: "A live Streamlit web app that predicts the risk of heart disease from a patient's clinical inputs (age, blood pressure, cholesterol, chest-pain type and more) using a K-Nearest Neighbors (KNN) classifier trained on a medical dataset.",
    tags: ["Machine Learning", "KNN", "Scikit-learn", "Pandas", "Streamlit"],
  },
  {
    title: "Medical Insurance Cost Prediction", icon: "🏥", category: "Machine Learning",
    link: "https://medical-insurance-cost-predictiongit-elkavfb6dkkffjgojjyaor.streamlit.app/",
    desc: "An interactive Streamlit app that estimates medical insurance charges from demographic and health factors such as age, BMI, number of children, smoking status and region, powered by a regression model with full data preprocessing and feature engineering.",
    tags: ["Machine Learning", "Regression", "Scikit-learn", "Pandas", "Streamlit"],
  },
  {
    title: "Customer Segmentation", icon: "👥", category: "Machine Learning",
    link: "https://github.com/tabindafayaz1111/Customer_Segmentation_Agglomerative_Clustering",
    desc: "Segmented wholesale customers by spending across product categories using agglomerative hierarchical clustering. Compared Ward, Complete, Average and Single linkage with dendrograms — Ward gave the best separation (silhouette score ~0.70).",
    tags: ["Machine Learning", "Agglomerative Clustering", "Scikit-learn", "SciPy", "Pandas"],
  },
  {
    title: "Employee Performance & Productivity Analysis", icon: "👨‍💼", category: "Data Analytics",
    link: "https://github.com/tabindafayaz1111/Python_Employee_Performance-Productivity_Analysis",
    desc: "Exploratory analysis of a 300-employee HR dataset that engineers a composite Productivity Score and studies how performance relates to department, role, age, remote work and job satisfaction through statistical charts and correlation heatmaps.",
    tags: ["Data Analytics", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Plotly"],
  },
  {
    title: "Diwali Sales Analysis", icon: "🎆", category: "Data Analytics",
    link: "https://github.com/tabindafayaz1111/Python-Diwali-Sales",
    desc: "Exploratory analysis of festive retail sales data that profiles the key buyer demographic, compares category preferences (food, clothing, electronics) and surfaces the top-selling products driving Diwali revenue.",
    tags: ["Data Analytics", "Pandas", "Matplotlib", "Seaborn"],
  },
  {
    title: "HR Analytics Dashboard", icon: "📊", category: "Dashboards",
    link: "https://github.com/tabindafayaz1111/Power-Bi-HR-Analysis",
    desc: "An interactive Power BI dashboard analyzing employee attrition across age, salary, job role, education field and tenure — highlighting high-risk segments such as employees aged 26–35, lower salary bands and early-tenure staff.",
    tags: ["Dashboards", "Power BI", "Data Visualization"],
  },
  {
    title: "Cafe Sales Analysis Dashboard", icon: "☕", category: "Dashboards",
    link: "https://github.com/tabindafayaz1111/python-powerbi-cafe-sales-analysis-and-dashboard",
    desc: "An end-to-end project combining Python data cleaning and EDA with an interactive Power BI dashboard to reveal cafe sales trends, product performance and revenue insights that support operational decisions.",
    tags: ["Dashboards", "Power BI", "Python", "Data Visualization"],
  },

];

/* ============ Render projects ============ */
const grid = document.getElementById("projectGrid");
let activeFilter = "all";
let query = "";

function renderProjects() {
  const filtered = projects.filter((p) => {
    const matchCat = activeFilter === "all" || p.category === activeFilter;
    const q = query.toLowerCase();
    const matchQuery =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q));
    return matchCat && matchQuery;
  });

  grid.innerHTML = filtered
    .map((p) => {
      const isLive = p.link.includes("streamlit") || p.link.includes("vercel.app") || p.link.includes("netlify.app");
      const isCode = p.link.includes("github.com");
      const label = isLive ? "Live Demo ↗" : isCode ? "View Code ↗" : "Open Project ↗";
      // Build footer links — if project has both a live link AND a github link, show both
      const footerLinks = p.github
        ? `<a href="${p.link}" target="_blank" rel="noopener">${label}</a><a href="${p.github}" target="_blank" rel="noopener" class="muted">GitHub ↗</a>`
        : `<a href="${p.link}" target="_blank" rel="noopener">${label}</a>`;
      return `
    <article class="proj reveal">
      <div class="proj-head">
        <span class="proj-title">${p.icon} ${p.title}</span>
        <a href="${p.link}" target="_blank" rel="noopener" class="proj-ext" aria-label="Open ${p.title}">↗</a>
      </div>
      <p class="proj-desc">${p.desc}</p>
      <div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <div class="proj-foot">
        ${footerLinks}
      </div>
    </article>`;
    })
    .join("");

  if (!filtered.length) {
    grid.innerHTML = `<p style="color:var(--muted-2);grid-column:1/-1;text-align:center;padding:40px 0;">No projects found.</p>`;
  }
  observeReveals();
}

/* ============ Filters & search ============ */
document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  document.querySelectorAll(".filter").forEach((f) => f.classList.remove("active"));
  btn.classList.add("active");
  activeFilter = btn.dataset.filter;
  renderProjects();
});

document.getElementById("search").addEventListener("input", (e) => {
  query = e.target.value;
  renderProjects();
});

/* ============ GitHub contribution graph (synthetic) ============ */
function buildGraph() {
  const graph = document.getElementById("ghGraph");
  const months = document.getElementById("ghMonths");
  if (!graph || !months) return; // contribution graph markup not present
  const weeks = 52;
  const labels = ["Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov"];
  months.innerHTML = labels.map((m) => `<span>${m}</span>`).join("");

  let html = "";
  let total = 0;
  // deterministic-ish pseudo random for a natural look
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < weeks * 7; i++) {
    const r = rand();
    let lvl = 0;
    if (r > 0.55) lvl = 1;
    if (r > 0.72) lvl = 2;
    if (r > 0.86) lvl = 3;
    if (r > 0.94) lvl = 4;
    total += lvl;
    html += `<span class="gh-cell l${lvl}"></span>`;
  }
  graph.innerHTML = html;
  document.getElementById("ghCount").textContent = `${total} contributions in the last year`;
}

/* ============ Scroll-spy nav ============ */
const navLinks = [...document.querySelectorAll(".nav-link")];
const sections = navLinks.map((l) => document.querySelector(l.getAttribute("href")));

function onScroll() {
  const pos = window.scrollY + window.innerHeight / 3;
  let current = sections[0];
  sections.forEach((s) => { if (s && s.offsetTop <= pos) current = s; });
  navLinks.forEach((l) =>
    l.classList.toggle("active", l.getAttribute("href") === "#" + (current && current.id))
  );
}
window.addEventListener("scroll", onScroll, { passive: true });

/* ============ Reveal on scroll ============ */
let io;
function observeReveals() {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
      { threshold: 0.12 }
    );
  }
  document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
}

/* mark static sections for reveal */
document.querySelectorAll(".card, .skill-group, .tl-item, .gh-card, .section-title, .section-lead")
  .forEach((el) => el.classList.add("reveal"));

/* ============ Profile photo save deterrents ============ */
/* Note: these only stop casual saving. Screenshots / screen recording
   cannot be blocked by any website — that's a browser/OS limitation. */
const navBrand = document.querySelector(".nav-brand");
if (navBrand) {
  navBrand.addEventListener("contextmenu", (e) => e.preventDefault());
  navBrand.addEventListener("dragstart", (e) => e.preventDefault());
}

/* ============ Expandable About cards ============ */
document.querySelectorAll(".cards .card").forEach((card) => {
  const hint = card.querySelector(".card-hint");
  const toggle = () => {
    const open = card.classList.toggle("open");
    card.setAttribute("aria-expanded", open ? "true" : "false");
    if (hint) hint.firstChild.textContent = open ? "Show less" : "Click to learn more";
  };
  card.addEventListener("click", toggle);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
});

/* ============ Contact form (Web3Forms) ============ */
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  const status = document.getElementById("formStatus");
  const submitBtn = document.getElementById("contactSubmit");
  const label = submitBtn.querySelector(".btn-label");

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const key = contactForm.querySelector('input[name="access_key"]').value;
    if (key === "YOUR_WEB3FORMS_ACCESS_KEY") {
      status.textContent = "Form not configured yet — add your Web3Forms access key in index.html.";
      status.className = "form-status err";
      return;
    }

    const original = label.textContent;
    submitBtn.disabled = true;
    label.textContent = "Sending…";
    status.textContent = "";
    status.className = "form-status";

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(contactForm),
      });
      const json = await res.json();
      if (json.success) {
        status.textContent = "✓ Thanks! Your message has been sent — I'll get back to you soon.";
        status.className = "form-status ok";
        contactForm.reset();
      } else {
        status.textContent = json.message || "Something went wrong. Please try again.";
        status.className = "form-status err";
      }
    } catch (err) {
      status.textContent = "Network error. Please check your connection and try again.";
      status.className = "form-status err";
    } finally {
      submitBtn.disabled = false;
      label.textContent = original;
    }
  });
}

/* ============ Scroll progress bar ============ */
const scrollProgress = document.getElementById("scrollProgress");
function updateProgress() {
  if (!scrollProgress) return;
  const h = document.documentElement;
  const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
  scrollProgress.style.transform = `scaleX(${Math.min(scrolled, 1)})`;
}
window.addEventListener("scroll", updateProgress, { passive: true });

/* ============ Theme toggle (dark / light) ============ */
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  const applyTheme = (theme) => {
    const isLight = theme === "light";
    document.body.classList.toggle("light", isLight);
    themeToggle.textContent = isLight ? "☀️" : "🌙";
    // Refresh the neural backdrop to the active theme's accent colours.
    if (window.__neuralRecolor) window.__neuralRecolor();
  };

  // Restore saved preference, otherwise follow the OS setting.
  const saved = localStorage.getItem("theme");
  const prefersLight =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(saved || (prefersLight ? "light" : "dark"));

  themeToggle.addEventListener("click", () => {
    const next = document.body.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

/* ============ Init ============ */
renderProjects();
buildGraph();
observeReveals();
onScroll();
updateProgress();
