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
    (book) =>
      path === book.index ||
      path.startsWith(book.id + "/") ||
      book.authorCheatsheet?.path === path
  );
}

function bookSequence(book) {
  const sequence = [{ title: "Оглавление", path: book.index }, ...book.chapters];
  if (book.authorCheatsheet) {
    sequence.push({
      title: book.authorCheatsheet.title,
      path: book.authorCheatsheet.path,
    });
  }
  return sequence;
}

function resolveLink(fromFile, href) {
  if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href)) return null;
  const url = new URL(href, new URL(fromFile, "https://local.invalid/"));
  const path = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return path.endsWith(".md") ? path : null;
}

function cardRow(path, titleHtml, subtitle) {
  const sub = subtitle ? `<span>${escapeHtml(subtitle)}</span>` : "";
  return ReadProgress.wrapCard(
    `#/${path}`,
    `<strong>${titleHtml}</strong>${sub}`,
    path
  );
}

function renderHome() {
  crumb.textContent = "";
  bar.hidden = true;
  const books = catalog.books
    .map((book) =>
      cardRow(
        book.index,
        escapeHtml(book.title),
        book.author
      ).outerHTML
    )
    .join("");
  const pains = catalog.pains
    .map((pain) =>
      cardRow(pain.path, escapeHtml(pain.title), "").outerHTML
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

function shporaProgressLabel(book) {
  const sheet = book.authorCheatsheet;
  if (!sheet?.pages) return "";
  const done = ReadProgress.countSections(sheet.path, sheet.pages);
  return `${done}/${sheet.pages} стр.`;
}

function renderBook(book) {
  crumb.textContent = book.title;
  bar.hidden = true;

  const indexCard = cardRow(book.index, "Оглавление", "вариант 1 — оглавление выжимки");
  const chapters = book.chapters
    .map((chapter, index) =>
      cardRow(
        chapter.path,
        `${index + 1}. ${escapeHtml(chapter.title)}`,
        ""
      ).outerHTML
    )
    .join("");

  let variant2 = "";
  if (book.authorCheatsheet) {
    const sheet = book.authorCheatsheet;
    const progress = shporaProgressLabel(book);
    variant2 = `
      <p class="section-label">Вариант 2 — шпора автора</p>
      <div class="card-list">
        ${cardRow(
          sheet.path,
          escapeHtml(sheet.title),
          `17 стр., индекс при отмазках · ${progress}`
        ).outerHTML}
      </div>`;
  }

  const resetBtn = book.authorCheatsheet
    ? `<p class="book-actions"><button type="button" class="btn-reset" id="reset-book-progress">Сбросить прогресс по книге</button></p>`
    : "";

  app.innerHTML = `
    <h1>${escapeHtml(book.title)}</h1>
    <p class="section-label">${escapeHtml(book.author)}</p>
    <p class="section-label">Вариант 1 — выжимка по главам</p>
    <div class="card-list">
      ${indexCard.outerHTML}
      ${chapters}
    </div>
    ${variant2}
    ${resetBtn}
  `;

  const reset = document.querySelector("#reset-book-progress");
  if (reset) {
    reset.addEventListener("click", () => {
      ReadProgress.clearBook(book.id);
      renderBook(book);
    });
  }
}

function prepareShporaHeadings(article) {
  article.querySelectorAll("h2").forEach((heading) => {
    let text = heading.textContent;
    const anchor = text.match(/\{#(p\d+)\}/);
    if (anchor) {
      heading.id = anchor[1];
      text = text.replace(/\s*\{#p\d+\}/, "");
      heading.textContent = text;
    }
    const page = text.match(/^Стр\.\s*(\d+)/);
    if (page && !heading.id) {
      heading.id = `p${page[1].padStart(2, "0")}`;
    }
  });
}

function decorateShporaSections(article, path, totalPages) {
  article.querySelectorAll("h2").forEach((heading) => {
    const page = heading.id?.match(/^p(\d+)$/);
    if (!page) return;

    const row = document.createElement("div");
    row.className = "read-row section-read-row";
    const id = ReadProgress.sectionId(path, Number(page[1]));
    if (ReadProgress.isRead(id)) row.classList.add("is-read");

    row.append(ReadProgress.createToggle(id, "Стр. прочитана"));
    heading.parentNode.insertBefore(row, heading);
  });

  return ReadProgress.countSections(path, totalPages);
}

function decorateDocumentReadBar(article, path, book) {
  const barEl = document.createElement("div");
  barEl.className = "doc-read-bar read-row";
  if (ReadProgress.isRead(path)) barEl.classList.add("is-read");

  const isShpora = book?.authorCheatsheet?.path === path;
  let summary = "";
  if (isShpora && book.authorCheatsheet.pages) {
    const done = ReadProgress.countSections(path, book.authorCheatsheet.pages);
    summary = `<span class="read-progress-summary">${done}/${book.authorCheatsheet.pages}</span>`;
    barEl.dataset.shporaPath = path;
    barEl.dataset.shporaPages = String(book.authorCheatsheet.pages);
  }

  barEl.innerHTML = summary;
  const toggle = ReadProgress.createToggle(
    path,
    isShpora ? "Вся шпора прочитана" : "Глава прочитана"
  );
  barEl.prepend(toggle);
  article.prepend(barEl);
}

async function renderDoc(path) {
  const book = findBook(path);
  const text = await loadMarkdown(path);
  const html = marked.parse(text);
  app.innerHTML = `<article class="prose">${html}</article>`;
  const article = app.querySelector(".prose");

  prepareShporaHeadings(article);
  if (book?.authorCheatsheet?.path === path) {
    decorateShporaSections(article, path, book.authorCheatsheet.pages);
  }
  decorateDocumentReadBar(article, path, book);

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
      if (path.includes("шпора-автор") && location.hash.includes("#p")) {
        const anchor = location.hash.split("#").pop();
        const el = document.getElementById(anchor);
        el?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    renderHome();
  } catch (error) {
    bar.hidden = true;
    app.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

document.addEventListener("richbook:read-change", () => {
  const barEl = document.querySelector(".doc-read-bar[data-shpora-path]");
  if (!barEl) return;
  const sum = barEl.querySelector(".read-progress-summary");
  if (!sum) return;
  const path = barEl.dataset.shporaPath;
  const pages = Number(barEl.dataset.shporaPages);
  if (path && pages) {
    sum.textContent = `${ReadProgress.countSections(path, pages)}/${pages}`;
  }
  const bookId = path.split("/")[0];
  const book = catalog?.books.find((b) => b.id === bookId);
  if (book && crumb.textContent === book.title && app.querySelector(".card-list")) {
    renderBook(book);
  }
});

window.addEventListener("hashchange", route);
route();
