import AppShell from "@/components/layout/AppShell";
import { dbSelect } from "@/lib/supabase-rest";
import {
  createEmployee, createLeaveRequest, createSubcontractor, createSubcontractorContract,
  updateEmployeeContract, updateLeaveRequest, updateSubcontractorContract,
} from "../domain-actions";
import { Empty, Field, input, Metric, PageTitle, primary, Section } from "../domain-ui";

type Employee={id:string;employee_code:string;full_name:string;position:string|null;department:string|null;status:string;contract_type:string;contract_start_date:string|null;contract_end_date:string|null;branches:{name:string}|null};
type Leave={id:string;request_type:string;start_date:string;end_date:string;status:string;employees:{full_name:string}|null};
type Subcontractor={id:string;party_type:string;name:string;document_number:string|null;contact_name:string|null;email:string|null;phone:string|null;specialty:string|null;status:string};
type Contract={id:string;contract_number:string;scope:string;start_date:string|null;end_date:string|null;contract_value:number;status:string;subcontractors:{name:string}|null;projects:{name:string}|null};
const money=new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});

export default async function HrPage(){
 const [companies,branches,projects,employees,leaves,subcontractors,contracts]=await Promise.all([
  dbSelect<{id:string;name:string}>("companies",{select:"id,name"}),
  dbSelect<{id:string;name:string}>("branches",{select:"id,name"}),
  dbSelect<{id:string;name:string}>("projects",{select:"id,name",order:"name.asc"}),
  dbSelect<Employee>("employees",{select:"id,employee_code,full_name,position,department,status,contract_type,contract_start_date,contract_end_date,branches(name)",order:"full_name.asc"}),
  dbSelect<Leave>("leave_requests",{select:"id,request_type,start_date,end_date,status,employees(full_name)",order:"created_at.desc"}),
  dbSelect<Subcontractor>("subcontractors",{select:"id,party_type,name,document_number,contact_name,email,phone,specialty,status",order:"name.asc"}),
  dbSelect<Contract>("subcontractor_contracts",{select:"id,contract_number,scope,start_date,end_date,contract_value,status,subcontractors(name),projects(name)",order:"created_at.desc"}),
 ]);
 return <AppShell>
  <PageTitle domain="Talento humano" title="Recursos Humanos" description="Empleados directos, contratos, ausencias y subcontratistas."/>
  <div className="mt-7 grid gap-4 md:grid-cols-4">
   <Metric label="Empleados activos" value={String(employees.filter(x=>x.status==="ACTIVE").length)}/>
   <Metric label="En nómina" value={String(employees.filter(x=>x.status==="ACTIVE"&&x.contract_type==="PAYROLL").length)}/>
   <Metric label="Obra y Labor" value={String(employees.filter(x=>x.status==="ACTIVE"&&x.contract_type==="WORK_AND_LABOR").length)}/>
   <Metric label="Subcontratistas" value={String(subcontractors.filter(x=>x.status==="ACTIVE").length)}/>
  </div>

  <div className="mt-7 grid gap-6 xl:grid-cols-2">
   <Section title="Nuevo empleado"><form action={createEmployee} className="mt-5 grid gap-4 md:grid-cols-2">
    <Field label="Empresa"><select required name="company_id" className={input}><option value="">Seleccionar</option>{companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Sede"><select name="branch_id" className={input}><option value="">Sin sede</option>{branches.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Código"><input required name="employee_code" className={input}/></Field><Field label="Nombre completo"><input required name="full_name" className={input}/></Field>
    <Field label="Documento"><input name="document_number" className={input}/></Field><Field label="Cargo"><input name="position" className={input}/></Field>
    <Field label="Departamento"><input name="department" className={input}/></Field>
    <Field label="Tipo de contrato"><select name="contract_type" className={input}><option value="PAYROLL">Nómina</option><option value="WORK_AND_LABOR">Obra y Labor</option></select></Field>
    <Field label="Inicio del contrato"><input type="date" name="contract_start_date" className={input}/></Field><Field label="Final del contrato"><input type="date" name="contract_end_date" className={input}/></Field>
    <Field label="Correo"><input type="email" name="email" className={input}/></Field><Field label="Teléfono"><input name="phone" className={input}/></Field>
    <button className={`${primary} md:col-span-2`}>Crear empleado</button>
   </form></Section>
   <Section title="Nueva solicitud de ausencia"><form action={createLeaveRequest} className="mt-5 grid gap-4 md:grid-cols-2">
    <Field label="Empleado"><select required name="employee_id" className={input}><option value="">Seleccionar</option>{employees.filter(x=>x.status==="ACTIVE").map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
    <Field label="Tipo"><select name="request_type" className={input}><option value="VACATION">Vacaciones</option><option value="PERMISSION">Permiso</option><option value="SICK_LEAVE">Incapacidad</option><option value="OTHER">Otro</option></select></Field>
    <Field label="Desde"><input required type="date" name="start_date" className={input}/></Field><Field label="Hasta"><input required type="date" name="end_date" className={input}/></Field>
    <div className="md:col-span-2"><Field label="Notas"><textarea name="notes" className={input}/></Field></div><button className={`${primary} md:col-span-2`}>Crear solicitud</button>
   </form></Section>
  </div>

  <Section title="Empleados y contratos"><div className="mt-3 divide-y">{employees.map(employee=><div key={employee.id} className="py-4">
   <div className="flex flex-wrap justify-between gap-2"><div><strong>{employee.full_name}</strong><p className="text-sm text-zinc-500">{employee.employee_code} · {employee.position||"Sin cargo"} · {employee.department||"Sin departamento"} · {employee.branches?.name||"Sin sede"}</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{employee.contract_type==="PAYROLL"?"Nómina":"Obra y Labor"}</span></div>
   <form action={updateEmployeeContract} className="mt-3 grid gap-2 md:grid-cols-[170px_150px_150px_130px_auto]"><input type="hidden" name="employee_id" value={employee.id}/><select name="contract_type" defaultValue={employee.contract_type} className="rounded-lg border px-2"><option value="PAYROLL">Nómina</option><option value="WORK_AND_LABOR">Obra y Labor</option></select><input type="date" name="contract_start_date" defaultValue={employee.contract_start_date||""} className="rounded-lg border px-2"/><input type="date" name="contract_end_date" defaultValue={employee.contract_end_date||""} className="rounded-lg border px-2"/><select name="status" defaultValue={employee.status} className="rounded-lg border px-2"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="TERMINATED">Retirado</option></select><button className="rounded-lg bg-zinc-950 px-3 py-2 text-white">Guardar</button></form>
  </div>)}{!employees.length&&<Empty text="No hay empleados registrados."/>}</div></Section>

  <div className="mt-7 grid gap-6 xl:grid-cols-2">
   <Section title="Nuevo subcontratista"><form action={createSubcontractor} className="mt-5 grid gap-4 md:grid-cols-2">
    <Field label="Empresa"><select required name="company_id" className={input}><option value="">Seleccionar</option>{companies.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Tipo"><select name="party_type" className={input}><option value="COMPANY">Empresa</option><option value="PERSON">Persona natural</option></select></Field>
    <Field label="Nombre o razón social"><input required name="name" className={input}/></Field><Field label="NIT o documento"><input name="document_number" className={input}/></Field>
    <Field label="Persona de contacto"><input name="contact_name" className={input}/></Field><Field label="Especialidad"><input name="specialty" className={input}/></Field>
    <Field label="Correo"><input type="email" name="email" className={input}/></Field><Field label="Teléfono"><input name="phone" className={input}/></Field>
    <button className={`${primary} md:col-span-2`}>Crear subcontratista</button>
   </form></Section>
   <Section title="Nuevo contrato de subcontratación"><form action={createSubcontractorContract} className="mt-5 grid gap-4 md:grid-cols-2">
    <Field label="Subcontratista"><select required name="subcontractor_id" className={input}><option value="">Seleccionar</option>{subcontractors.filter(x=>x.status==="ACTIVE").map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Proyecto"><select name="project_id" className={input}><option value="">Sin proyecto</option>{projects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Número"><input required name="contract_number" className={input}/></Field><Field label="Tipo"><select name="contract_type" className={input}><option value="SUBCONTRACT">Subcontrato</option><option value="SERVICE_ORDER">Orden de servicio</option></select></Field>
    <div className="md:col-span-2"><Field label="Alcance"><textarea required name="scope" className={input}/></Field></div>
    <Field label="Inicio"><input type="date" name="start_date" className={input}/></Field><Field label="Final"><input type="date" name="end_date" className={input}/></Field>
    <Field label="Valor"><input type="number" min="0" step="any" name="contract_value" className={input}/></Field><Field label="Estado"><select name="status" className={input}><option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option></select></Field>
    <button className={`${primary} md:col-span-2`}>Crear contrato</button>
   </form></Section>
  </div>

  <div className="mt-7 grid gap-6 xl:grid-cols-2">
   <Section title="Directorio de subcontratistas"><div className="mt-3 divide-y">{subcontractors.map(item=><div key={item.id} className="py-3"><div className="flex justify-between"><strong>{item.name}</strong><span className="text-xs font-bold">{item.status}</span></div><p className="text-sm text-zinc-500">{item.party_type==="COMPANY"?"Empresa":"Persona natural"} · {item.document_number||"Sin documento"} · {item.specialty||"Sin especialidad"}</p><p className="text-xs text-zinc-500">{item.contact_name||"Sin contacto"} · {item.email||item.phone||"Sin contacto"}</p></div>)}{!subcontractors.length&&<Empty text="No hay subcontratistas."/>}</div></Section>
   <Section title="Contratos de subcontratación"><div className="mt-3 divide-y">{contracts.map(contract=><div key={contract.id} className="py-3"><div className="flex justify-between"><strong>{contract.contract_number} · {contract.subcontractors?.name}</strong><span>{money.format(Number(contract.contract_value))}</span></div><p className="text-sm text-zinc-500">{contract.projects?.name||"Sin proyecto"} · {contract.start_date||"Sin inicio"} → {contract.end_date||"Sin final"}</p><p className="mt-1 text-sm">{contract.scope}</p><form action={updateSubcontractorContract} className="mt-2 flex gap-2"><input type="hidden" name="subcontractor_contract_id" value={contract.id}/><select name="status" defaultValue={contract.status} className="rounded-lg border px-2"><option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="COMPLETED">Terminado</option><option value="CANCELLED">Cancelado</option></select><button className="rounded-lg bg-zinc-950 px-3 text-white">Guardar</button></form></div>)}{!contracts.length&&<Empty text="No hay contratos."/>}</div></Section>
  </div>

  <Section title="Solicitudes de ausencia"><div className="mt-3 divide-y">{leaves.map(item=><div key={item.id} className="py-3"><p className="font-semibold">{item.employees?.full_name} · {item.request_type}</p><p className="text-xs text-zinc-500">{item.start_date} → {item.end_date}</p><form action={updateLeaveRequest} className="mt-2 flex gap-2"><input type="hidden" name="leave_id" value={item.id}/><select name="status" defaultValue={item.status} className="rounded-lg border px-2"><option value="PENDING">Pendiente</option><option value="APPROVED">Aprobada</option><option value="REJECTED">Rechazada</option></select><button className="rounded-lg bg-zinc-950 px-3 text-white">Guardar</button></form></div>)}{!leaves.length&&<Empty text="No hay solicitudes."/>}</div></Section>
 </AppShell>;
}
