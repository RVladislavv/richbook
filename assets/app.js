const app = document.querySelector("#app");
const crumb = document.querySelector("#crumb");
const bar = document.querySelector("#bar");
const base = new URL(".", window.location.href);

let catalog = null;

marked.setOptions({ gfm: true, breaks: false });

function pathFromHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return raw;
}

function go(path) {
  location.hash = path ? "#/" + path : "#/";
}

async function loadCatalog() {
  const response = await fetch(new URL("catalog.json", base));
  if (!response.ok) throw new Error("Нет catalog.json");
  catalog = await response.json();
}

async function loadMarkdown(path) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(new URL(encoded, base));
  if (!response.ok) throw new Error("Не открывается " + path);
  return response.text();
}

function findBook(path) {
  return catalog.books.find(
    (book) => path === book.index || path.startsWith(book.id + "/")
  );
}

function bookSequence(book) {
  return [{ title: "Оглавление", path: book.index }, ...book.chapters];
}

function resolveLink(fromFile, href) {
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return null;
  const url = new URL(href, new URL(fromFile, "https://local.invalid/"));
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return path.endsWith(".md") ? path : null;
}

function renderHome() {
  crumb.textContent = "";
  bar.hidden = true;
  const books = catalog.books
    .map(
      (book) =>
        `<a class="card" href="#/${book.index}"><strong>${escapeHtml(book.title)}</strong><span>${escapeHtml(book.author)}</span></a>`
    )
    .join("");
  const pains = catalog.pains
    .map(
      (pain) =>
        `<a class="card" href="#/${pain.path}"><strong>${escapeHtml(pain.title)}</strong></a>`
    )
    .join("");
  app.innerHTML = `
    <h1>Читальня</h1>
    <p class="section-label">Книги</p>
    <div class="card-list">${books}</div>
    <p class="section-label">Боль</p>
    <div class="card-list">${pains}</div>
  `;
}

function renderBook(book) {
  crumb.textContent = book.title;
  bar.hidden = true;
  const chapters = book.chapters
    .map(
      (chapter, index) =>
        `<a class="card" href="#/${chapter.path}"><strong>${index + 1}. ${escapeHtml(chapter.title)}</strong></a>`
    )
    .join("");
  app.innerHTML = `
    <h1>${escapeHtml(book.title)}</h1>
    <p class="section-label">${escapeHtml(book.author)}</p>
    <div class="card-list">
      <a class="card" href="#/${book.index}"><strong>Оглавление</strong></a>
      ${chapters}
    </div>
  `;
}

async function renderDoc(path) {
  const book = findBook(path);
  const text = await loadMarkdown(path);
  const html = marked.parse(text);
  app.innerHTML = `<article class="prose">${html}</article>`;
  app.querySelectorAll("a").forEach((link) => {
    const next = resolveLink(path, link.getAttribute("href"));
    if (!next) return;
    link.href = "#/" + next;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      go(next);
    });
  });

  if (!book) {
    crumb.textContent = "Боль";
    bar.hidden = false;
    bar.innerHTML = `<a href="#/">На главную</a>`;
    return;
  }

  crumb.textContent = book.title;
  const sequence = bookSequence(book);
  const index = sequence.findIndex((item) => item.path === path);
  const prev = index > 0 ? sequence[index - 1] : null;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  bar.hidden = false;
  bar.innerHTML = `
    <a href="#/${book.id}">К книге</a>
    <a href="${prev ? "#/" + prev.path : "#"}" ${prev ? "" : 'aria-disabled="true"'}>Назад</a>
    <a href="${next ? "#/" + next.path : "#"}" ${next ? "" : 'aria-disabled="true"'}>Дальше</a>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function route() {
  const path = pathFromHash();
  try {
    if (!catalog) await loadCatalog();
    if (!path) {
      renderHome();
      return;
    }
    const bookById = catalog.books.find((book) => book.id === path);
    if (bookById) {
      renderBook(bookById);
      return;
    }
    if (path.endsWith(".md")) {
      await renderDoc(path);
      return;
    }
    renderHome();
  } catch (error) {
    bar.hidden = true;
    app.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

window.addEventListener("hashchange", route);
route();
