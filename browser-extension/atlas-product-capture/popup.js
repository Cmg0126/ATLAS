const atlasUrl = "https://atlas-theta-plum.vercel.app";
const fields = Object.fromEntries(["code", "model", "brand", "description", "price", "unit"].map((id) => [id, document.getElementById(id)]));
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
      const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || "";
      const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || "";
      const body = document.body.innerText.replace(/\u00a0/g, " ");
      const title = attr('meta[property="og:title"]', "content") || text("h1") || document.title;
      const description = attr('meta[property="og:description"]', "content") || text('[class*="description" i]') || title;
      const urlCode = location.pathname.split("/").filter(Boolean).pop() || "";
      const codeMatch = body.match(/(?:c[oó]digo|sku)\s*:?\s*([A-Z0-9._/-]{4,})/i);
      const modelMatch = body.match(/(?:referencia|modelo)\s*:?\s*([A-Z0-9._/-]{3,})/i);
      const brandMatch = body.match(/(?:marca|fabricante)\s*:?\s*([^\n|]{2,50})/i);
      const candidates = [...document.querySelectorAll("body *")]
        .map((node) => node.children.length ? "" : (node.textContent || "").trim())
        .filter((value) => /^\$\s*[\d.,]+$/.test(value));
      const price = candidates.find((value) => /[1-9]/.test(value)) || (body.match(/\$\s*[\d.]+(?:,\d{2})?/) || [""])[0];
      return {
        sourceUrl: location.href,
        code: codeMatch?.[1] || urlCode,
        model: modelMatch?.[1] || urlCode,
        brand: brandMatch?.[1] || "",
        description,
        price,
        unit: "UND"
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
