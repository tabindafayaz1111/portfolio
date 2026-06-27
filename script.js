/* ============ Project data — edit this list to add your own ============ */
const projects = [
  {
    title: " Medical Insurance Cost Prediction", icon: "🏠", category: "Machine Learning", link: "#",
    desc: "Developed a machine learning model to estimate medical insurance costs based on demographic and health-related factors. The project includes data preprocessing, feature engineering, model training, and prediction to support cost estimation.",
    tags: ["Machine Learning", "Pandas", "NumPy", "Scikit-learn", "joblib","streamlit"],
  },
  {
    title: " Employee Performance & Productivity Analysis", icon: "👨‍💼", category: "Data Analytics", link: "#",
    desc: "Performed exploratory data analysis to identify productivity trends, employee performance metrics, and workplace insights through data visualization and statistical analysis.",
    tags: ["Data Analytics", "Pandas", "NumPy", "Matplotlib ", " Seaborn"," Plotly"],
  },
  {
    title: "Customer Segmentation using Machine Learning", icon: "👥", category: "Machine Learning", link: "#",
    desc: "Implemented multiple clustering algorithms to segment customers based on purchasing behavior, enabling targeted marketing strategies and business decision-making.",
    tags: ["Machine Learning", "Agglomerative Clustering", "NumPy", "Scikit-learn", "Pandas"],
  },
  {
    title: " HR Analytics Dashboard", icon: "📊", category: "Dashboards", link: "#",
    desc: "Created an interactive HR dashboard that provides insights into employee performance, workforce distribution, attrition, and organizational KPIs using Power BI.",
    tags: ["Dashboards", "Power BI", "Data Visualization"],
  },
  {
    title: " Cafe Sales Analysis Dashboard", icon: "☕", category: "Dashboards", link: "#",
    desc: "Analyzed cafe sales data to discover customer purchasing patterns, revenue trends, and product performance through data analysis and interactive dashboards.",
    tags: ["Dashboards", "Power BI", "Data Visualization"],
  },
  {
    title: " Pizza Sales Analysis", icon: "🍕", category: "Dashboards", link: "#",
    desc: "Conducted comprehensive sales analysis on pizza orders to identify best-selling products, peak sales periods, and revenue trends for business optimization.",
    tags: ["Dashboards", "Power BI", "Data Visualization"],
  },
  {
    title: " Diwali Sales Analysis", icon: "🎆", category: "Dashboards", link: "#",
    desc: "Performed exploratory analysis of festive retail sales data to understand customer demographics, buying behavior, and seasonal purchasing patterns.",
    tags: ["Dashboards", "Power BI", "Data Visualization"],
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
    .map(
      (p) => `
    <article class="proj reveal">
      <div class="proj-head">
        <span class="proj-title">${p.icon} ${p.title}</span>
        <a href="${p.link}" class="proj-ext" aria-label="Open ${p.title}">↗</a>
      </div>
      <p class="proj-desc">${p.desc}</p>
      <div class="tags">${p.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <div class="proj-foot">
        <a href="${p.link}">Details</a>
        <a href="${p.link}" class="muted">Open Project ↗</a>
      </div>
    </article>`
    )
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
