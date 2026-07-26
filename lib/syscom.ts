import "server-only";

const API_URL = "https://developers.syscomcolombia.com/api/v1";
const TOKEN_URL = "https://developers.syscomcolombia.com/oauth/token";

type Token = { accessToken: string; expiresAt: number };
let cachedToken: Token | null = null;

export type SyscomProduct = {
  id: string;
  model: string;
  name: string;
  brand: string;
  stock: number;
  price: number;
  listPrice: number;
  imageUrl: string | null;
  category: string | null;
  raw: Record<string, unknown>;
};

function number(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;
  const clientId = process.env.SYSCOM_CLIENT_ID;
  const clientSecret = process.env.SYSCOM_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Faltan las credenciales SYSCOM en Vercel.");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; message?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.message || `SYSCOM rechazó la autenticación (HTTP ${response.status}).`);
  }
  cachedToken = {
    accessToken: body.access_token,
    expiresAt: Date.now() + Math.max(300, Number(body.expires_in ?? 3600)) * 1000,
  };
  return cachedToken.accessToken;
}

function normalizeProduct(value: unknown): SyscomProduct | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const prices = item.precios && typeof item.precios === "object"
    ? item.precios as Record<string, unknown>
    : item;
  const categories = Array.isArray(item.categorias) ? item.categorias : [];
  const firstCategory = categories.find((candidate) => candidate && typeof candidate === "object") as Record<string, unknown> | undefined;
  const id = String(item.producto_id ?? item.id ?? "").trim();
  const model = String(item.modelo ?? item.sku ?? "").trim();
  if (!id && !model) return null;
  return {
    id: id || model,
    model,
    name: String(item.titulo ?? item.nombre ?? item.descripcion ?? model).trim(),
    brand: String(item.marca ?? "").trim(),
    stock: number(item.total_existencia ?? item.existencia),
    price: number(prices.precio_especial ?? prices.precio_descuento ?? prices.precio_descuentos ?? prices.precio_lista),
    listPrice: number(prices.precio_lista),
    imageUrl: String(item.img_portada ?? item.imagen ?? "").trim() || null,
    category: firstCategory ? String(firstCategory.nombre ?? "").trim() || null : null,
    raw: item,
  };
}

function findProductRows(value: unknown, depth = 0): unknown[] {
  if (depth > 4 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === "object" && (
      "producto_id" in (item as Record<string, unknown>) ||
      "modelo" in (item as Record<string, unknown>) ||
      "titulo" in (item as Record<string, unknown>)
    ))) return value;
    for (const item of value) {
      const nested = findProductRows(item, depth + 1);
      if (nested.length) return nested;
    }
    return [];
  }
  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    const nested = findProductRows(nestedValue, depth + 1);
    if (nested.length) return nested;
  }
  return [];
}

export async function searchSyscomProducts(query: string) {
  const token = await getToken();
  const url = new URL(`${API_URL}/productos`);
  url.searchParams.set("busqueda", query.trim().replace(/\s+/g, "+"));
  url.searchParams.set("cop", "true");
  url.searchParams.set("stock", "true");
  url.searchParams.set("orden", "relevancia");
  url.searchParams.set("pagina", "1");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? String((body as { message: unknown }).message)
      : `SYSCOM no respondió correctamente (HTTP ${response.status}).`;
    throw new Error(message);
  }
  const rows = findProductRows(body);
  return rows.map(normalizeProduct).filter((item): item is SyscomProduct => Boolean(item)).slice(0, 30);
}
