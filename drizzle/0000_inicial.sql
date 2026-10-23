CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"contato" text,
	"email" text,
	"telefone" text,
	"prazo_pagamento_dias" integer DEFAULT 30 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fechamento_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"fechamento_id" integer NOT NULL,
	"lancamento_id" integer NOT NULL,
	"paciente_nome" text NOT NULL,
	"tipo" text NOT NULL,
	"modal" text,
	"data" date NOT NULL,
	"hora" text,
	"origem" text,
	"destino" text,
	"quantidade" integer NOT NULL,
	"valor_unitario" numeric(12, 2) NOT NULL,
	"valor_total" numeric(12, 2) NOT NULL,
	"observacoes" text
);
--> statement-breakpoint
CREATE TABLE "fechamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"area" text NOT NULL,
	"competencia" text NOT NULL,
	"periodo_inicio" date NOT NULL,
	"periodo_fim" date NOT NULL,
	"quantidade_itens" integer NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'calculado' NOT NULL,
	"numero_nf" text,
	"data_envio" date,
	"data_aprovacao" date,
	"data_nf" date,
	"data_vencimento" date,
	"data_pagamento" date,
	"valor_pago" numeric(12, 2),
	"observacoes" text,
	"criado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"area" text NOT NULL,
	"tipo" text NOT NULL,
	"paciente_id" integer NOT NULL,
	"empresa_id" integer NOT NULL,
	"data" date NOT NULL,
	"hora" text,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"valor_unitario" numeric(12, 2) NOT NULL,
	"valor_total" numeric(12, 2) NOT NULL,
	"modal" text,
	"origem" text,
	"destino" text,
	"custo_terceiro" numeric(12, 2),
	"percentual_acrescimo" numeric(5, 2),
	"status" text DEFAULT 'realizado' NOT NULL,
	"motivo_cancelamento" text,
	"observacoes" text,
	"fechamento_id" integer,
	"criado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pacientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"empresa_id" integer NOT NULL,
	"regiao_id" integer,
	"endereco" text,
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regioes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regioes_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "tarifas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"modal" text,
	"paciente_id" integer,
	"empresa_id" integer,
	"regiao_id" integer,
	"valor" numeric(12, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" text DEFAULT 'operador' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamento_itens" ADD CONSTRAINT "fechamento_itens_fechamento_id_fechamentos_id_fk" FOREIGN KEY ("fechamento_id") REFERENCES "public"."fechamentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamento_itens" ADD CONSTRAINT "fechamento_itens_lancamento_id_lancamentos_id_fk" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos" ADD CONSTRAINT "fechamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fechamentos" ADD CONSTRAINT "fechamentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_fechamento_id_fechamentos_id_fk" FOREIGN KEY ("fechamento_id") REFERENCES "public"."fechamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pacientes" ADD CONSTRAINT "pacientes_regiao_id_regioes_id_fk" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_regiao_id_regioes_id_fk" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "auditoria" USING btree ("entidade","entidade_id");--> statement-breakpoint
CREATE INDEX "fechamento_itens_fechamento_idx" ON "fechamento_itens" USING btree ("fechamento_id");--> statement-breakpoint
CREATE INDEX "fechamentos_competencia_idx" ON "fechamentos" USING btree ("competencia","empresa_id");--> statement-breakpoint
CREATE INDEX "lancamentos_data_idx" ON "lancamentos" USING btree ("data");--> statement-breakpoint
CREATE INDEX "lancamentos_empresa_data_idx" ON "lancamentos" USING btree ("empresa_id","data");--> statement-breakpoint
CREATE INDEX "lancamentos_paciente_idx" ON "lancamentos" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "pacientes_empresa_idx" ON "pacientes" USING btree ("empresa_id");