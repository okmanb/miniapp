"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestPasswordReset, setNewPassword, verifyRecoveryCode } from "@/app/auth-actions";
import { AuthError, AuthSubmit } from "./AuthShell";
import { Spinner } from "./ui";

type Step = "email" | "codigo" | "clave";

const NOTES: Record<Step, string> = {
  email: "Te mandamos un código de 6 dígitos para volver a entrar. Tus datos quedan intactos.",
  codigo: "Mirá tu mail y escribí el código. Vence a los pocos minutos.",
  clave: "Listo. Poné una clave nueva y entrás directo.",
};

/**
 * Recuperar la clave, los tres pasos (pantalla 14).
 *
 * Vive en un solo componente y no en tres rutas porque el mail tiene que
 * sobrevivir del paso 1 al 2 y no puede viajar por la URL: una dirección en un
 * query string queda en los logs del servidor y en el historial del navegador.
 *
 * El titular cambia con el paso: "Recuperar clave" mientras se pide el código
 * y otra cosa después. Una pantalla que dice lo mismo en los tres pasos no
 * deja saber en cuál se está.
 */
export function RecoveryFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setError(null);

      if (step === "email") {
        const result = await requestPasswordReset(email);
        if (result.ok) setStep("codigo");
        else setError(result.message);
        return;
      }

      if (step === "codigo") {
        const result = await verifyRecoveryCode(email, code);
        if (result.ok) setStep("clave");
        else setError(result.message);
        return;
      }

      const result = await setNewPassword(password);
      if (result.ok) router.push("/dashboard");
      else setError(result.message);
    });
  }

  return (
    <>
      <p className="help mt-1.5">{NOTES[step]}</p>

      <form onSubmit={submit} className="mt-6">
        {step === "email" && (
          <Field
            id="email"
            label="Email de tu cuenta"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />
        )}

        {step === "codigo" && (
          <Field
            id="token"
            label="Código de 6 dígitos"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            mono
            value={code}
            onChange={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            help={`Se lo mandamos a ${email}.`}
          />
        )}

        {step === "clave" && (
          <Field
            id="password"
            label="Clave nueva"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            help="Mínimo 8 caracteres. Usá una que no uses en el banco."
          />
        )}

        {error && <AuthError message={error} />}

        <AuthSubmit>
          {pending && <Spinner className="mr-2 text-white" />}
          {step === "email" ? "Enviarme el código" : step === "codigo" ? "Verificar" : "Guardar y entrar"}
          <span className="ml-1" aria-hidden>
            →
          </span>
        </AuthSubmit>
      </form>

      <div className="mt-5 space-y-2 text-[12px]">
        {step === "codigo" && (
          <p className="text-muted">
            ¿No llegó?{" "}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="text-pine underline underline-offset-2"
            >
              Pedir otro código
            </button>
          </p>
        )}
        <p className="text-muted">
          <Link href="/login" className="text-pine underline underline-offset-2">
            Volver a ingresar
          </Link>
        </p>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  inputMode,
  mono = false,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "numeric";
  mono?: boolean;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-label uppercase text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoFocus
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 min-h-touch w-full rounded-surface border border-border-input bg-surface px-3 text-[15px] text-ink outline-none ${
          mono ? "font-mono tracking-[0.35em]" : ""
        }`}
      />
      {help && <p className="help mt-1.5">{help}</p>}
    </div>
  );
}
