import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Rosé Finance" },
      {
        name: "description",
        content: "Acesse sua conta para organizar entradas, gastos, contas e metas.",
      },
      { property: "og:title", content: "Entrar — Rosé Finance" },
      {
        property: "og:description",
        content: "Acesse sua conta para organizar entradas, gastos, contas e metas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "User already registered": "Este e-mail já tem conta. Faça login.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
};

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<"confirm" | "reset" | null>(null);

  // Já autenticada? Vai direto para o painel.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/painel", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: "/painel", replace: true });
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const fail = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "Algo deu errado";
    toast.error(MESSAGES[msg] ?? msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vinda de volta 💗");
        navigate({ to: "/painel", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/painel", replace: true });
        } else {
          setSent("confirm");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (err) {
      fail(err);
    }
  };

  if (sent) {
    return (
      <Shell>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
          <Mail className="size-6 text-primary" />
        </div>
        <h1 className="mt-4 font-display text-2xl">Verifique seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sent === "confirm"
            ? `Enviamos um link de confirmação para ${email}. Confirme para entrar.`
            : `Enviamos um link para redefinir sua senha para ${email}.`}
        </p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => {
            setSent(null);
            setMode("login");
          }}
        >
          Voltar para o login
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl text-foreground">Rosé Finance</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "login"
          ? "Bem-vinda de volta 💗"
          : mode === "signup"
            ? "Crie sua conta e comece hoje 💗"
            : "Vamos recuperar seu acesso"}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="name">Como quer ser chamada?</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="voce@email.com"
          />
        </div>

        {mode !== "forgot" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </Button>
      </form>

      {mode !== "forgot" && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google} type="button">
            Continuar com Google
          </Button>
        </>
      )}

      <div className="mt-5 space-y-2 text-center text-sm">
        {mode === "login" && (
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode("forgot")}
          >
            Esqueci minha senha
          </button>
        )}
        <p className="text-muted-foreground">
          {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-soft px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft">
        {children}
      </div>
    </div>
  );
}
