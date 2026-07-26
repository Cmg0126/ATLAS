import "server-only";
import { dbSelect } from "@/lib/supabase-rest";

type QuotationSequence = {
  quotation_consecutive: number | null;
};

export async function getNextQuotationNumberPreview() {
  const year = new Date().getFullYear();
  const [latest] = await dbSelect<QuotationSequence>("quotations", {
    select: "quotation_consecutive",
    quotation_year: `eq.${year}`,
    order: "quotation_consecutive.desc",
    limit: 1,
  });
  const initialConsecutive = year === 2026 ? 78 : 1;
  const nextConsecutive = latest?.quotation_consecutive
    ? Number(latest.quotation_consecutive) + 1
    : initialConsecutive;
  const shortYear = String(year % 100).padStart(2, "0");

  return `COT-${nextConsecutive}-${shortYear}1`;
}
