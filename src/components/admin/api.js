// Small helper the admin screens use to talk to our API routes.
// - pass { json: {...} } to send JSON, or { body: FormData } to upload a file
// - throws an Error with a readable message if something goes wrong
// - if the login has expired (401) it sends you to the login page
export async function api(url, { json, ...options } = {}) {
  const init = { cache: "no-store", ...options, headers: { ...(options.headers || {}) } };
  if (json !== undefined) {
    init.method = init.method || "POST";
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(json);
  }

  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Please log in again.");
  }
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
