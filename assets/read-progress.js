const ReadProgress = (() => {
  const STORAGE_KEY = "richbook:read:v1";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isRead(id) {
    return Boolean(load()[id]);
  }

  function setRead(id, value) {
    const state = load();
    if (value) state[id] = true;
    else delete state[id];
    save(state);
  }

  function toggle(id) {
    setRead(id, !isRead(id));
  }

  function sectionId(path, pageNum) {
    const n = String(pageNum).padStart(2, "0");
    return `${path}#p${n}`;
  }

  function countSections(path, total) {
    let n = 0;
    for (let i = 1; i <= total; i += 1) {
      if (isRead(sectionId(path, i))) n += 1;
    }
    return n;
  }

  function clearBook(bookId) {
    const prefix = bookId + "/";
    const state = load();
    let changed = false;
    for (const key of Object.keys(state)) {
      if (key.startsWith(prefix)) {
        delete state[key];
        changed = true;
      }
    }
    if (changed) save(state);
  }

  function createToggle(id, labelText) {
    const aria = labelText || "Прочитано";
    const labelEl = document.createElement("label");
    labelEl.className = "read-toggle";
    labelEl.title = aria;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isRead(id);
    input.setAttribute("aria-label", aria);
    input.addEventListener("change", () => {
      setRead(id, input.checked);
      labelEl.closest(".card-row, .read-row, .doc-read-bar")?.classList.toggle(
        "is-read",
        input.checked
      );
      document.dispatchEvent(new CustomEvent("richbook:read-change", { detail: { id } }));
    });

    labelEl.append(input);
    return labelEl;
  }

  function wrapCard(href, innerHtml, readId, progressText, bookId, reserveCountColumn) {
    const row = document.createElement("div");
    row.className = "card-row";
    if (isRead(readId)) row.classList.add("is-read");

    const link = document.createElement("a");
    link.className = "card";
    link.href = href;
    link.innerHTML = innerHtml;

    const aside = document.createElement("div");
    aside.className = "read-aside";
    if (progressText) {
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = progressText;
      if (bookId) count.dataset.bookId = bookId;
      aside.append(count);
    } else if (reserveCountColumn) {
      const placeholder = document.createElement("span");
      placeholder.className = "count count--empty";
      placeholder.setAttribute("aria-hidden", "true");
      aside.append(placeholder);
    }
    aside.append(createToggle(readId));

    row.append(link, aside);

    return row;
  }

  return {
    STORAGE_KEY,
    load,
    isRead,
    setRead,
    toggle,
    sectionId,
    countSections,
    clearBook,
    createToggle,
    wrapCard,
  };
})();
