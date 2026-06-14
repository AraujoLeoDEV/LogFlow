import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import logoIcon from '@/assets/logo-icon.png';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#221a45] to-[#0c0e1c] p-4">
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-[#5b3df5]/30 blur-3xl" />
      <div className="relative mb-6 flex flex-col items-center gap-2">
        <img src={logoIcon} alt="" className="size-16 rounded-2xl shadow-lg" />
        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-2xl font-bold text-transparent">
          LogFlow
        </span>
      </div>
      <Card className="relative w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Entrar</CardTitle>
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
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
