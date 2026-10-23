import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { sair } from "../login/actions";

const MENU = [
  { titulo: "Operação", itens: [
    { href: "/", rotulo: "Painel" },
    { href: "/lancamentos", rotulo: "Lançamentos" },
    { href: "/lancamentos/novo?area=enfermagem", rotulo: "+ Enfermagem" },
    { href: "/lancamentos/novo?area=logistica", rotulo: "+ Corrida" },
  ]},
  { titulo: "Faturamento", itens: [
    { href: "/fechamentos/novo", rotulo: "Novo fechamento" },
    { href: "/fechamentos", rotulo: "Histórico / recebimentos" },
  ]},
  { titulo: "Cadastros", itens: [
    { href: "/pacientes", rotulo: "Pacientes" },
    { href: "/empresas", rotulo: "Empresas" },
    { href: "/regioes", rotulo: "Regiões" },
    { href: "/tarifas", rotulo: "Tarifas" },
    { href: "/configuracoes", rotulo: "Configurações" },
  ]},
];

const MENU_ADMIN = [
  { href: "/usuarios", rotulo: "Usuários" },
  { href: "/auditoria", rotulo: "Auditoria" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const usuario = await exigirUsuario();
  const grupos = usuario.perfil === "admin" ? [...MENU, { titulo: "Administração", itens: MENU_ADMIN }] : MENU;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-gray-200 bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-5 py-4">
          <Link href="/" className="text-lg font-semibold text-teal-800">CuraLog</Link>
          <p className="text-xs text-gray-500">{usuario.nome}</p>
        </div>
        <nav className="flex gap-6 overflow-x-auto px-3 pb-4 md:block md:space-y-5">
          {grupos.map((g) => (
            <div key={g.titulo} className="min-w-max">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{g.titulo}</p>
              {g.itens.map((i) => (
                <Link key={i.href} href={i.href} className="block rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-800">
                  {i.rotulo}
                </Link>
              ))}
            </div>
          ))}
          <form action={sair} className="min-w-max px-2">
            <button className="text-sm text-gray-500 hover:text-red-700">Sair</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
