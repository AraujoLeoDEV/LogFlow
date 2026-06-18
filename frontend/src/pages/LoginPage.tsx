import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { AuthHero } from '@/components/layout/AuthHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { APP_VERSION, changelog } from '@/lib/changelog';

const WHATS_NEW_STORAGE_KEY = 'whats-new-last-seen-version';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(WHATS_NEW_STORAGE_KEY);
    if (lastSeenVersion !== APP_VERSION) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWhatsNewOpen(true);
    }
  }, []);

  function closeWhatsNew() {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, APP_VERSION);
    setWhatsNewOpen(false);
  }

  if (!isLoading && user) {
    const redirectTo = (location.state as LocationState | null)?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(values: LoginFormValues) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(values);
      const redirectTo = (location.state as LocationState | null)?.from ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 429) {
          setErrorMessage('Muitas tentativas de login. Aguarde um minuto e tente novamente.');
        } else {
          const message = (error.response?.data as { message?: string } | undefined)?.message;
          setErrorMessage(message ?? 'Não foi possível fazer login. Tente novamente.');
        }
      } else {
        setErrorMessage('Não foi possível conectar ao servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthHero>
      <Card className="relative w-full max-w-sm border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <p className="font-mono mb-1 text-xs font-medium tracking-widest text-violet-300/70 uppercase">
            Acesso ao sistema
          </p>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Sistema de Logística e Controle de Frota</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        autoComplete="username"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {errorMessage && (
                <p className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}
              <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
              <Link
                to="/esqueci-senha"
                className="text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Esqueci minha senha
              </Link>
            </form>
          </Form>
        </CardContent>
      </Card>
      <button
        type="button"
        onClick={() => setWhatsNewOpen(true)}
        className="relative mt-4 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
      >
        O que há de novo · {APP_VERSION}
      </button>

      <Dialog
        open={whatsNewOpen}
        onOpenChange={(open) => {
          if (!open) closeWhatsNew();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>O que há de novo</DialogTitle>
            <DialogDescription>Últimas melhorias e correções do sistema.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-6 overflow-y-auto p-4 pt-0">
            {changelog.map((entry) => (
              <div key={entry.version}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-medium">{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {entry.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AuthHero>
  );
}
