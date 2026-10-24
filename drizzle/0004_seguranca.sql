CREATE TABLE "tentativas_login" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"sucesso" boolean NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "trocar_senha" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "tentativas_email_idx" ON "tentativas_login" USING btree ("email","criado_em");--> statement-breakpoint
CREATE INDEX "tentativas_ip_idx" ON "tentativas_login" USING btree ("ip","criado_em");