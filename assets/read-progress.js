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

  function createToggle(id, label) {
    const labelEl = document.createElement("label");
    labelEl.className = "read-toggle";
    labelEl.title = label || "Прочитано";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = isRead(id);
    input.addEventListener("change", () => {
      setRead(id, input.checked);
      labelEl.closest(".card-row, .read-row, .doc-read-bar")?.classList.toggle(
        "is-read",
        input.checked
      );
      document.dispatchEvent(new CustomEvent("richbook:read-change", { detail: { id } }));
    });

    const span = document.createElement("span");
    span.textContent = label || "Прочитано";

    labelEl.append(input, span);
    return labelEl;
  }

  function wrapCard(href, innerHtml, readId) {
    const row = document.createElement("div");
    row.className = "card-row";
    if (isRead(readId)) row.classList.add("is-read");

    const link = document.createElement("a");
    link.className = "card";
    link.href = href;
    link.innerHTML = innerHtml;

    row.append(link, createToggle(readId, ""));

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
