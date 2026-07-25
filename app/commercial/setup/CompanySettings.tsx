import { dbSelect } from "@/lib/supabase-rest";
import { createCompanyCiiu, createCompanyContact, createCompanyTaxEvent, updateCompanyProfile } from "../actions";
import { Field, input } from "../ui";

type Company = Record<string, string | number | boolean | null> & { id:string; name:string };
type Row = Record<string, string | boolean | null> & { id:string };
const box="rounded-2xl border border-zinc-800 bg-zinc-950 p-6";

export async function CompanySettings() {
  const [company]=await dbSelect<Company>("companies",{select:"*",order:"name.asc",limit:1});
  if(!company)return <p className={`${box} mt-8`}>No hay una empresa registrada.</p>;
  const [contacts,ciiu,events]=await Promise.all([
    dbSelect<Row>("company_contacts",{select:"*",company_id:`eq.${company.id}`}),
    dbSelect<Row>("company_ciiu_codes",{select:"*",company_id:`eq.${company.id}`}),
    dbSelect<Row>("company_tax_calendar",{select:"*",company_id:`eq.${company.id}`,order:"due_date.asc"}),
  ]);
  const v=(key:string)=>String(company[key]??"");
  const fields=[["trade_name","Nombre comercial"],["nit","NIT"],["verification_digit","Dígito de verificación"],["entity_type","Tipo de entidad"],["chamber_registration","Matrícula mercantil"],["address","Dirección"],["city","Ciudad"],["department","Departamento"],["country","País"],["postal_code","Código postal"],["phone","Teléfono"],["mobile","Celular"],["email","Correo corporativo"],["website","Página web"],["legal_representative","Representante legal"],["representative_document","Documento representante"],["tax_regime","Régimen tributario"],["invoice_resolution","Resolución de facturación"]] as const;
  return <>
    <form action={updateCompanyProfile} className={`${box} mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4`}>
      <input type="hidden" name="company_id" value={company.id}/>
      <h2 className="text-xl font-bold md:col-span-2 xl:col-span-4">Ficha legal, tributaria y financiera</h2>
      <Field label="Razón social"><input name="legal_name" required defaultValue={v("legal_name")||company.name} className={input}/></Field>
      {fields.map(([key,label])=><Field key={key} label={label}><input name={key} defaultValue={v(key)||(key==="country"?"Colombia":"")} className={input}/></Field>)}
      <Field label="Fecha de constitución"><input type="date" name="incorporation_date" defaultValue={v("incorporation_date")} className={input}/></Field>
      <Field label="IVA general (%)"><input type="number" min="0" max="100" step=".01" name="default_tax_percent" defaultValue={v("default_tax_percent")||"19"} className={input}/></Field>
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
  </>;
}
