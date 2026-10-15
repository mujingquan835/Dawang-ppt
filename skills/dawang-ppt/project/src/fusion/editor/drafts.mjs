async function openDraftStore() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("dawang-project-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "projectId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return { get: (projectId) => new Promise((resolve, reject) => {
    const r = db.transaction("projects").objectStore("projects").get(projectId);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }), put: (record) => new Promise((resolve, reject) => {
    const t = db.transaction("projects", "readwrite");
    t.objectStore("projects").put(record);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  }), close: () => db.close() };
}
function draftDecision(record, project) {
  if (!record) return "none";
  return record.baseRevision === project.revision ? "restore" : "conflict";
}
export {
  draftDecision,
  openDraftStore
};
