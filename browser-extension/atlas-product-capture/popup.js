const atlasUrl = "https://atlas-theta-plum.vercel.app";
const fields = Object.fromEntries(["code", "model", "brand", "description", "price", "currency", "unit"].map((id) => [id, document.getElementById(id)]));
const message = document.getElementById("message");

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function readProduct() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://tienda.sonepar.co/")) {
    throw new Error("Abre primero la página de un producto en tienda.sonepar.co.");
  }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const text = (selector) => clean(document.querySelector(selector)?.textContent);
      const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || "";
      const body = document.body.innerText.replace(/\u00a0/g, " ");
      const title = attr('meta[property="og:title"]', "content") || text("h1") || document.title;
      const rows = [...document.querySelectorAll("tr")];
      const rowValue = (label) => {
        const row = rows.find((candidate) => {
          const cells = [...candidate.querySelectorAll("th,td")];
          return clean(cells[0]?.textContent).toUpperCase() === label.toUpperCase();
        });
        const cells = row ? [...row.querySelectorAll("th,td")] : [];
        return clean(cells.at(-1)?.textContent);
      };
      const lines = body.split(/\n+/).map(clean).filter(Boolean);
      const lineValue = (label) => {
        const normalizedLabel = label.toUpperCase();
        const index = lines.findIndex((line) => line.toUpperCase() === normalizedLabel || line.toUpperCase().startsWith(`${normalizedLabel}:`));
        if (index < 0) return "";
        const inline = lines[index].replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "");
        return clean(inline || lines[index + 1]);
      };
      const code = rowValue("SKU Sonepar") || lineValue("SKU Sonepar");
      const model = rowValue("SKU Fabricante") || lineValue("SKU Fabricante");
      const brand = rowValue("MARCA") || lineValue("MARCA");
      const description = lineValue("Descripción") || attr('meta[property="og:description"]', "content") || title;
      const urlCode = location.pathname.split("/").filter(Boolean).pop() || "";
      const priceMatch = body.match(/Precio\s*:\s*\(([A-Z]{3})\)\s*([\d.,]+)\s*([A-Z]+)/i);
      const fallbackPrice = body.match(/\$\s*([\d.]+(?:,\d{2})?)/);
      return {
        sourceUrl: location.href,
        code: code || urlCode,
        model: model || code || urlCode,
        brand,
        description,
        price: priceMatch?.[2] || fallbackPrice?.[1] || "",
        currency: priceMatch?.[1]?.toUpperCase() || "COP",
        unit: priceMatch?.[3]?.toUpperCase() || "UND"
      };
    }
  });
  if (!result) throw new Error("No pude leer la página del producto.");
  return result;
}

readProduct().then((product) => {
  Object.entries(fields).forEach(([key, input]) => { input.value = cleanText(product[key]); });
  fields.description.dataset.sourceUrl = product.sourceUrl;
}).catch((error) => {
  showMessage(error.message);
  document.getElementById("send").disabled = true;
});

document.getElementById("capture-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, cleanText(input.value)]));
  payload.sourceUrl = fields.description.dataset.sourceUrl;
  if (!payload.sourceUrl) return showMessage("No se encontró la dirección del producto.");
  await chrome.tabs.create({ url: `${atlasUrl}/catalog/capture?payload=${encodePayload(payload)}` });
  window.close();
});
