CREATE TABLE "plano_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano_id" integer NOT NULL,
	"descricao" text NOT NULL,
	"horarios" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" serial PRIMARY KEY NOT NULL,
	"paciente_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"inicio_data" date NOT NULL,
	"inicio_hora" text NOT NULL,
	"fim_data" date,
	"fim_hora" text,
	"valor_unitario" numeric(12, 2),
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lancamentos" ADD COLUMN "plano_id" integer;--> statement-breakpoint
ALTER TABLE "plano_itens" ADD CONSTRAINT "plano_itens_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos" ADD CONSTRAINT "planos_paciente_id_pacientes_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planos" ADD CONSTRAINT "planos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planos_paciente_idx" ON "planos" USING btree ("paciente_id");--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamentos_plano_data_idx" ON "lancamentos" USING btree ("plano_id","data");