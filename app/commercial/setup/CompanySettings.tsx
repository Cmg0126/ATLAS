import { dbSelect } from "@/lib/supabase-rest";
import { createCompanyCiiu, createCompanyContact, createCompanyTaxEvent, updateCompanyProfile } from "../actions";
import { uploadReusableDocument } from "../../tenders/documents/actions";
import { RupForm } from "../../tenders/profile/rup-form";
import { Field, input } from "../ui";

type Company = Record<string, string | number | boolean | null> & { id:string; name:string };
type Row = Record<string, string | boolean | null> & { id:string };
type Rup = {
  issue_date: string | null; valid_until: string | null; fiscal_year: number | null;
  current_assets: number; current_liabilities: number; total_assets: number; total_liabilities: number;
  equity: number; operating_profit: number; interest_expense: number; net_income: number;
  residual_capacity: number; is_mipyme: boolean; domicile: string | null; notes: string | null;
};
const box="rounded-2xl border border-zinc-800 bg-zinc-950 p-6";

export async function CompanySettings() {
  const [company]=await dbSelect<Company>("companies",{select:"*",order:"name.asc",limit:1});
  if(!company)return <p className={`${box} mt-8`}>No hay una empresa registrada.</p>;
  const [contacts,ciiu,events,documents,[rup]]=await Promise.all([
    dbSelect<Row>("company_contacts",{select:"*",company_id:`eq.${company.id}`}),
    dbSelect<Row>("company_ciiu_codes",{select:"*",company_id:`eq.${company.id}`}),
    dbSelect<Row>("company_tax_calendar",{select:"*",company_id:`eq.${company.id}`,order:"due_date.asc"}),
    dbSelect<Row>("reusable_tender_documents",{select:"id,category,name,file_size,issue_date,valid_until,created_at",company_id:`eq.${company.id}`,order:"created_at.desc"}),
    dbSelect<Rup>("rup_profiles",{select:"issue_date,valid_until,fiscal_year,current_assets,current_liabilities,total_assets,total_liabilities,equity,operating_profit,interest_expense,net_income,residual_capacity,is_mipyme,domicile,notes",company_id:`eq.${company.id}`}),
  ]);
  const rupValues: Rup = rup ?? {
    issue_date:null,valid_until:null,fiscal_year:null,current_assets:0,current_liabilities:0,
    total_assets:0,total_liabilities:0,equity:0,operating_profit:0,interest_expense:0,
    net_income:0,residual_capacity:0,is_mipyme:false,domicile:null,notes:null,
  };
  const v=(key:string)=>String(company[key]??"");
  const fields=[["trade_name","Nombre comercial"],["nit","NIT"],["verification_digit","Dígito de verificación"],["entity_type","Tipo de entidad"],["chamber_registration","Matrícula mercantil"],["address","Dirección"],["city","Ciudad"],["department","Departamento"],["country","País"],["postal_code","Código postal"],["phone","Teléfono"],["mobile","Celular"],["email","Correo corporativo"],["website","Página web"],["legal_representative","Representante legal"],["representative_document","Documento representante"],["tax_regime","Régimen tributario"],["invoice_resolution","Resolución de facturación"]] as const;
  return <>
    <nav className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <a href="#datos-empresa" className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 font-bold text-white hover:border-yellow-500">1. Datos de la empresa</a>
      <a href="#impuestos-iva" className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 font-bold text-white hover:border-yellow-500">2. Impuestos e IVA</a>
      <a href="#rup-empresa" className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 font-bold text-white hover:border-yellow-500">3. RUP</a>
      <a href="#documentos-empresa" className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 font-bold text-white hover:border-yellow-500">4. Subir documentos</a>
    </nav>
    <form id="datos-empresa" action={updateCompanyProfile} className={`${box} mt-8 grid scroll-mt-6 gap-4 md:grid-cols-2 xl:grid-cols-4`}>
      <input type="hidden" name="company_id" value={company.id}/>
      <h2 className="text-xl font-bold md:col-span-2 xl:col-span-4">Ficha legal, tributaria y financiera</h2>
      <Field label="Razón social"><input name="legal_name" required defaultValue={v("legal_name")||company.name} className={input}/></Field>
      {fields.map(([key,label])=><Field key={key} label={label}><input name={key} defaultValue={v(key)||(key==="country"?"Colombia":"")} className={input}/></Field>)}
      <Field label="Fecha de constitución"><input type="date" name="incorporation_date" defaultValue={v("incorporation_date")} className={input}/></Field>
      <div id="impuestos-iva" className="scroll-mt-6"><Field label="IVA general (%)"><input type="number" min="0" max="100" step=".01" name="default_tax_percent" defaultValue={v("default_tax_percent")||"19"} className={input}/></Field></div>
      <Field label="Capital social"><input type="number" min="0" name="social_capital" defaultValue={v("social_capital")||"0"} className={input}/></Field>
      <Field label="Capital pagado"><input type="number" min="0" name="paid_in_capital" defaultValue={v("paid_in_capital")||"0"} className={input}/></Field>
      <Field label="Responsabilidades tributarias"><textarea name="tax_responsibilities" defaultValue={v("tax_responsibilities")} className={input}/></Field>
      <label className="flex items-center gap-2"><input type="checkbox" name="withholding_agent" defaultChecked={Boolean(company.withholding_agent)}/>Agente retenedor</label>
      <label className="flex items-center gap-2"><input type="checkbox" name="industry_commerce_taxpayer" defaultChecked={Boolean(company.industry_commerce_taxpayer)}/>Responsable de ICA</label>
      <Field label="Notas"><textarea name="notes" defaultValue={v("notes")} className={input}/></Field>
      <button className="rounded-xl bg-yellow-500 p-3 font-semibold text-black md:col-span-2 xl:col-span-4">Guardar ficha empresarial</button>
    </form>
    <div className="mt-6 grid gap-6 xl:grid-cols-3">
      <section className={box}><h2 className="text-xl font-bold">Contactos</h2>{contacts.map(x=><p key={x.id} className="mt-2 rounded-lg bg-zinc-900 p-3">{x.full_name} · {x.position||x.email||x.phone}</p>)}<form action={createCompanyContact} className="mt-4 space-y-2"><input type="hidden" name="company_id" value={company.id}/><input required name="full_name" placeholder="Nombre" className={input}/><input name="position" placeholder="Cargo" className={input}/><input type="email" name="email" placeholder="Correo" className={input}/><input name="phone" placeholder="Teléfono" className={input}/><label className="flex gap-2"><input type="checkbox" name="is_primary"/>Principal</label><button className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black">Agregar</button></form></section>
      <section className={box}><h2 className="text-xl font-bold">Códigos CIIU</h2>{ciiu.map(x=><p key={x.id} className="mt-2 rounded-lg bg-zinc-900 p-3">{x.code} · {x.description}</p>)}<form action={createCompanyCiiu} className="mt-4 space-y-2"><input type="hidden" name="company_id" value={company.id}/><input required name="code" placeholder="Código" className={input}/><textarea name="description" placeholder="Descripción" className={input}/><label className="flex gap-2"><input type="checkbox" name="is_primary"/>Principal</label><button className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black">Agregar</button></form></section>
      <section className={box}><h2 className="text-xl font-bold">Calendario tributario</h2>{events.map(x=><p key={x.id} className="mt-2 rounded-lg bg-zinc-900 p-3">{x.obligation} · {x.due_date} · {x.status}</p>)}<form action={createCompanyTaxEvent} className="mt-4 space-y-2"><input type="hidden" name="company_id" value={company.id}/><input required name="obligation" placeholder="Obligación" className={input}/><input name="period" placeholder="Período" className={input}/><input required type="date" name="due_date" className={input}/><input type="number" name="tax_year" defaultValue={new Date().getFullYear()} className={input}/><button className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black">Agregar vencimiento</button></form><p className="mt-3 text-xs text-zinc-500">Usa fechas verificadas por tu contador o la DIAN.</p></section>
    </div>
    <section className={`${box} mt-6`}>
      <h2 className="text-xl font-bold">Banco documental empresarial</h2>
      <p className="mt-1 text-sm text-zinc-400">Documentos reutilizables para proveedores, clientes y licitaciones.</p>
      <div id="rup-empresa" className="mt-6 scroll-mt-6 rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <h3 className="text-lg font-bold">RUP y perfil de contratación</h3>
        <p className="mt-1 text-sm text-zinc-400">Sube el RUP aquí. ATLAS guarda el PDF como documento base, extrae la información financiera y la experiencia, y permite corregirla antes de alimentar el radar SECOP.</p>
        <RupForm companyId={company.id} values={rupValues}/>
      </div>
      <div className="mt-5 grid gap-6 xl:grid-cols-[380px_1fr]">
        <form id="documentos-empresa" action={uploadReusableDocument} className="scroll-mt-6 space-y-3 rounded-xl bg-zinc-900 p-4">
          <input type="hidden" name="company_id" value={company.id}/>
          <Field label="Tipo"><select name="category" className={input}><option value="CAMARA_COMERCIO">Cámara de Comercio</option><option value="RUT">RUT</option><option value="CEDULA_REPRESENTANTE">Cédula del representante legal</option><option value="DECLARACION_RENTA">Declaración de renta</option><option value="ESTADOS_FINANCIEROS">Estados financieros</option><option value="CERTIFICACION">Certificación</option><option value="OTRO">Otro</option></select></Field>
          <Field label="Archivo"><input required type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className={input}/></Field>
          <Field label="Fecha de expedición"><input type="date" name="issue_date" className={input}/></Field>
          <Field label="Vigente hasta"><input type="date" name="valid_until" className={input}/></Field>
          <button className="w-full rounded-xl bg-yellow-500 p-3 font-semibold text-black">Guardar documento</button>
        </form>
        <div className="divide-y divide-zinc-800">{documents.map(document=><div key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{document.name}</p><p className="text-sm text-zinc-400">{String(document.category).replaceAll("_"," ")} · Expedición: {document.issue_date||"sin fecha"} · Vigencia: {document.valid_until||"sin vencimiento"}</p></div><a href={`/api/tenders/documents/${document.id}`} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-700 px-4 py-2 font-semibold">Abrir</a></div>)}{!documents.length&&<p className="py-8 text-center text-zinc-500">Todavía no hay documentos empresariales.</p>}</div>
      </div>
    </section>
  </>;
}
