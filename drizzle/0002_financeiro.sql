CREATE TABLE "despesas" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"categoria" text NOT NULL,
	"descricao" text,
	"valor" numeric(12, 2) NOT NULL,
	"area" text NOT NULL,
	"modal" text,
	"veiculo_id" integer,
	"litros" numeric(10, 2),
	"km" integer,
	"status" text DEFAULT 'ativa' NOT NULL,
	"motivo_cancelamento" text,
	"criado_por" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "veiculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"descricao" text NOT NULL,
	"placa" text,
	"modal" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_veiculo_id_veiculos_id_fk" FOREIGN KEY ("veiculo_id") REFERENCES "public"."veiculos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "despesas_data_idx" ON "despesas" USING btree ("data");