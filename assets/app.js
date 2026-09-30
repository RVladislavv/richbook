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
  const [catRes, expRes] = await Promise.all([
    fetch(new URL("catalog.json", base)),
    fetch(new URL("expected-books.json", base)),
  ]);
  if (!catRes.ok) throw new Error("Нет catalog.json");
  catalog = await catRes.json();
  if (expRes.ok) {
    const expected = await expRes.json();
    catalog.expectedBooks = expected.books || [];
  } else {
    catalog.expectedBooks = [];
  }
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

function chapterReadCount(book) {
  const done = book.chapters.filter((chapter) => ReadProgress.isRead(chapter.path)).length;
  return { done, total: book.chapters.length };
}

function resolveLink(fromFile, href) {
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return null;
  const url = new URL(href, new URL(fromFile, "https://local.invalid/"));
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return path.endsWith(".md") ? path : null;
}

function cardListHead(opts) {
  const o = opts || {};
  let countPart = "";
  if (o.progressText) {
    countPart = `<span class="count" id="book-read-count" data-book-id="${escapeHtml(o.bookId)}">${escapeHtml(o.progressText)}</span>`;
  } else if (o.countColumn) {
    countPart = `<span class="count count--empty" aria-hidden="true"></span>`;
  }
  return `<div class="card-list-head">
    <span class="card-list-head-spacer"></span>
    <div class="read-aside read-aside--head">
      ${countPart}
      <span class="read-col-label">Статус</span>
    </div>
  </div>`;
}

function cardRow(path, titleHtml, subtitle, progressText, bookId, reserveCountColumn) {
  const sub = subtitle ? `<span>${escapeHtml(subtitle)}</span>` : "";
  return ReadProgress.wrapCard(
    `#/${path}`,
    `<strong>${titleHtml}</strong>${sub}`,
    path,
    progressText || "",
    bookId || "",
    Boolean(reserveCountColumn)
  );
}

function simpleCard(path, title) {
  return `<a class="card" href="#/${path}"><strong>${escapeHtml(title)}</strong></a>`;
}

function expectedBookCard(book) {
  const author = book.author ? `<span>${escapeHtml(book.author)}</span>` : "";
  return `<div class="card card--muted"><strong>${escapeHtml(book.title)}</strong>${author}</div>`;
}

function progressNote() {
  return `<p class="footnote"><span class="star" aria-hidden="true">*</span>Прогресс сохраняется в этом браузере.</p>`;
}

function renderHome() {
  crumb.textContent = "";
  bar.hidden = true;
  const books = catalog.books
    .map((book) => {
      const { done, total } = chapterReadCount(book);
      return cardRow(
        book.index,
        escapeHtml(book.title),
        book.author,
        total ? `${done}/${total}` : "",
        book.id
      ).outerHTML;
    })
    .join("");
  const pains = catalog.pains.map((pain) => simpleCard(pain.path, pain.title)).join("");
  const expected = (catalog.expectedBooks || [])
    .map((book) => expectedBookCard(book))
    .join("");
  const expectedCount = (catalog.expectedBooks || []).length;
  const expectedBlock = expected
    ? `<details class="expected-books">
    <summary class="expected-books-summary">Ожидаемые книги <span class="expected-books-count">${expectedCount}</span></summary>
    <p class="section-hint">Пока без выжимки</p>
    <div class="card-list card-list--plain">${expected}</div>
  </details>`
    : "";
  app.innerHTML = `
    <h1>Читальня</h1>
    <p class="section-label">Книги</p>
    ${cardListHead({ countColumn: true })}
    <div class="card-list">${books}</div>
    ${expectedBlock}
    <p class="section-label">Боль</p>
    <div class="card-list card-list--plain">${pains}</div>
    <a class="card chat-card" href="https://t.me/antiskufchat" target="_blank" rel="noopener"><strong>Чат</strong><span>t.me/antiskufchat</span></a>
    ${progressNote()}
  `;
}

function renderBook(book) {
  crumb.textContent = book.title;
  bar.hidden = true;

  const { done, total } = chapterReadCount(book);
  const reserveCount = Boolean(total);
  const indexCard = cardRow(book.index, "Оглавление", "", "", "", reserveCount);
  const chapters = book.chapters
    .map((chapter, index) =>
      cardRow(
        chapter.path,
        `${index + 1}. ${escapeHtml(chapter.title)}`,
        "",
        "",
        "",
        reserveCount
      ).outerHTML
    )
    .join("");

  const listHead = total
    ? cardListHead({ progressText: `${done}/${total}`, bookId: book.id })
    : cardListHead({});

  app.innerHTML = `
    <h1>${escapeHtml(book.title)}</h1>
    <p class="section-label">${escapeHtml(book.author)}</p>
    ${listHead}
    <div class="card-list">
      ${indexCard.outerHTML}
      ${chapters}
    </div>
    <p class="book-actions"><button type="button" class="btn-reset" id="reset-book-progress">Сбросить прогресс по книге</button></p>
    ${progressNote()}
  `;

  document.querySelector("#reset-book-progress").addEventListener("click", () => {
    ReadProgress.clearBook(book.id);
    renderBook(book);
  });
}

function decorateDocumentReadBar(article, path) {
  const barEl = document.createElement("div");
  barEl.className = "doc-read-bar read-row";
  if (ReadProgress.isRead(path)) barEl.classList.add("is-read");
  const statusLabel = document.createElement("span");
  statusLabel.className = "read-col-label";
  statusLabel.textContent = "Статус";
  barEl.append(statusLabel, ReadProgress.createToggle(path));
  article.prepend(barEl);
}

async function renderDoc(path) {
  const book = findBook(path);
  const text = await loadMarkdown(path);
  const html = marked.parse(text);
  app.innerHTML = `<article class="prose">${html}</article>`;
  const article = app.querySelector(".prose");
  if (book) decorateDocumentReadBar(article, path);

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

document.addEventListener("richbook:read-change", () => {
  if (!catalog) return;
  document.querySelectorAll(".count[data-book-id]").forEach((el) => {
    const book = catalog.books.find((item) => item.id === el.dataset.bookId);
    if (!book) return;
    const { done, total } = chapterReadCount(book);
    el.textContent = `${done}/${total}`;
  });
});

window.addEventListener("hashchange", route);
route();
