const API = "http://108.130.119.116:3000";

async function load() {
  const res = await fetch(API + "/messages");
  const data = await res.json();

  const list = document.getElementById("list");
  list.innerHTML = "";

  data.forEach(m => {
    const li = document.createElement("li");
    li.textContent = m.content;
    list.appendChild(li);
  });
}

async function send() {
  const input = document.getElementById("msg");

  await fetch(API + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.value })
  });

  input.value = "";
  load();
}

load();