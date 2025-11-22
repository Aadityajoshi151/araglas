export async function loadNavbar() {
  const el = document.getElementById('navbar');
  if (!el) return;
  const res = await fetch('/partials/navbar.html');
  const html = await res.text();
  el.innerHTML = html;
}
