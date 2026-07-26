import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Item = {
  description: string; unit: string; quantity: number; unit_price: number;
  discount_percent: number; tax_percent: number;
};
type Quote = {
  quotation_number: string | null; status: string; created_at: string;
  validity_date: string | null; notes: string | null; subtotal: number;
  discount_total: number; tax_total: number; total: number;
  quotation_items: Item[];
  opportunities: {
    title: string;
    clients: {
      name: string; nit: string | null; email: string | null; phone: string | null;
      companies: {
        name: string; legal_name: string | null; nit: string | null; address: string | null;
        city: string | null; phone: string | null; email: string | null; website: string | null;
      } | null;
    } | null;
  } | null;
};

const money = (value: number) => new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", minimumFractionDigits: 2,
}).format(Number(value || 0));
const date = (value: string | null) => value
  ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(`${value.slice(0, 10)}T12:00:00-05:00`))
  : "No definida";

function createPdf(quote: Quote, logo: Buffer | null) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: { Title: quote.quotation_number || "Cotización" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const company = quote.opportunities?.clients?.companies;
    const client = quote.opportunities?.clients;
    const left = 42;
    const right = 553;
    const usable = right - left;

    if (logo) doc.image(logo, left, 36, { fit: [145, 70] });
    doc.fillColor("#f5b800").font("Helvetica-Bold").fontSize(22).text("COTIZACIÓN", 350, 42, { width: 203, align: "right" });
    doc.fillColor("#111111").fontSize(12).text(quote.quotation_number || "Sin número", 350, 70, { width: 203, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor("#555555")
      .text(company?.legal_name || company?.name || "ITLATAM GROUP S.A.S.", left, 108)
      .text(`NIT: ${company?.nit || "No registrado"}`)
      .text([company?.address, company?.city].filter(Boolean).join(", "))
      .text([company?.phone, company?.email, company?.website].filter(Boolean).join(" · "));
    doc.moveTo(left, 158).lineTo(right, 158).lineWidth(2).strokeColor("#f5b800").stroke();

    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(10).text("CLIENTE", left, 177);
    doc.font("Helvetica").fontSize(9)
      .text(client?.name || "Sin cliente", left, 195)
      .text(`NIT: ${client?.nit || "No registrado"}`)
      .text([client?.phone, client?.email].filter(Boolean).join(" · "));
    doc.font("Helvetica-Bold").text("Fecha:", 330, 177).font("Helvetica").text(date(quote.created_at), 390, 177, { width: 163 });
    doc.font("Helvetica-Bold").text("Vigencia:", 330, 195).font("Helvetica").text(date(quote.validity_date), 390, 195, { width: 163 });
    doc.font("Helvetica-Bold").text("Proyecto:", 330, 213).font("Helvetica").text(quote.opportunities?.title || "Sin oportunidad", 390, 213, { width: 163 });

    let y = 252;
    const widths = [27, 241, 43, 49, 72, 79];
    const headers = ["#", "Descripción", "Und.", "Cant.", "Vr. unitario", "Total"];
    const drawHeader = () => {
      doc.rect(left, y, usable, 24).fill("#171717");
      let x = left;
      headers.forEach((header, index) => {
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5).text(header, x + 4, y + 8, { width: widths[index] - 8, align: index > 1 ? "right" : "left" });
        x += widths[index];
      });
      y += 24;
    };
    drawHeader();
    quote.quotation_items.forEach((item, index) => {
      const gross = Number(item.quantity) * Number(item.unit_price);
      const net = gross * (1 - Number(item.discount_percent) / 100);
      const rowHeight = Math.max(30, doc.heightOfString(item.description, { width: widths[1] - 8 }) + 12);
      if (y + rowHeight > 710) {
        doc.addPage(); y = 48; drawHeader();
      }
      if (index % 2 === 0) doc.rect(left, y, usable, rowHeight).fill("#f4f4f5");
      let x = left;
      const values = [String(index + 1), item.description, item.unit, String(Number(item.quantity)), money(Number(item.unit_price)), money(net)];
      values.forEach((value, column) => {
        doc.fillColor("#222222").font("Helvetica").fontSize(7.5).text(value, x + 4, y + 8, { width: widths[column] - 8, align: column > 1 ? "right" : "left" });
        x += widths[column];
      });
      y += rowHeight;
    });
    if (!quote.quotation_items.length) {
      doc.fillColor("#666666").font("Helvetica").fontSize(9).text("Esta cotización no contiene partidas.", left, y + 12, { width: usable, align: "center" });
      y += 40;
    }
    if (y > 610) { doc.addPage(); y = 48; }
    y += 15;
    const totalsX = 330;
    const totalRows: [string, number][] = [
      ["Subtotal bruto", quote.subtotal], ["Descuentos", -quote.discount_total],
      ["IVA", quote.tax_total], ["TOTAL", quote.total],
    ];
    totalRows.forEach(([label, value], index) => {
      const final = index === totalRows.length - 1;
      if (final) doc.rect(totalsX, y - 4, 223, 24).fill("#f5b800");
      doc.fillColor(final ? "#111111" : "#333333").font(final ? "Helvetica-Bold" : "Helvetica").fontSize(final ? 10 : 9)
        .text(label, totalsX + 6, y + 2, { width: 90 })
        .text(money(value), totalsX + 96, y + 2, { width: 121, align: "right" });
      y += final ? 28 : 20;
    });
    if (quote.notes) {
      y += 8;
      doc.fillColor("#111111").font("Helvetica-Bold").fontSize(9).text("CONDICIONES COMERCIALES", left, y);
      doc.fillColor("#444444").font("Helvetica").fontSize(8).text(quote.notes, left, y + 16, { width: usable });
    }
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc.fillColor("#777777").font("Helvetica").fontSize(7)
        .text(`ATLAS ERP · ${quote.quotation_number || "Cotización"} · Página ${index + 1} de ${range.count}`, left, 805, { width: usable, align: "center" });
    }
    doc.end();
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.from("quotations").select(`
    quotation_number,status,created_at,validity_date,notes,subtotal,discount_total,tax_total,total,
    quotation_items(description,unit,quantity,unit_price,discount_percent,tax_percent),
    opportunities(title,clients(name,nit,email,phone,companies(name,legal_name,nit,address,city,phone,email,website)))
  `).eq("id", id).order("created_at", { referencedTable: "quotation_items", ascending: true }).maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "Cotización no encontrada." }, { status: 404 });
  let logo: Buffer | null = null;
  try { logo = await readFile(path.join(process.cwd(), "public", "logo-itlatam.png")); } catch { /* PDF remains usable without logo. */ }
  const pdf = await createPdf(data as unknown as Quote, logo);
  const filename = `${data.quotation_number || "cotizacion"}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" },
  });
}
